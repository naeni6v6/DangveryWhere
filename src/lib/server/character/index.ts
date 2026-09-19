/**
 * 캐릭터 생성 파이프라인 (서버 전용).
 *
 *   사진 → [분석: Claude 또는 Gemini] → 특징 JSON
 *   특징 + 사진 + 닮은 캐릭터 3장 → [Gemini 이미지 생성] → 그림
 *   그림 → [Gemini 부위 탐지] → 부위 위치 (실패해도 그림은 돌려줍니다)
 *
 * 키가 하나도 없으면(개발 중) 데모 모드로 동작합니다. API 키는 여기서만 읽고 브라우저에는
 * 절대 내려가지 않아요.
 */
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { findBreed } from '$lib/domain/breeds';
import {
  MAX_IMAGE_DATA_LENGTH,
  normalizeTraits,
  validateLayout,
  type CharacterLayout,
  type DogTraits,
  type Expression,
  type FurColorKey
} from '$lib/domain/character';
import { analyzeWithClaude } from './claude';
import { CharacterError, toCharacterError } from './errors';
import {
  callGeminiImage,
  callGeminiJson,
  image as imagePart,
  text as textPart,
  type InlineImage
} from './gemini';
import { mockCharacter, mockTraits } from './mock';
import {
  analysisPrompt,
  generationPrompt,
  layoutPrompt,
  layoutSchema,
  traitsSchema
} from './prompts';
import { pickReferenceKeys, referenceImage } from './references';

export type Provider = 'claude' | 'gemini' | 'mock';

const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image';

function config() {
  const gemini = env.GEMINI_API_KEY?.trim() || '';
  const anthropic = env.ANTHROPIC_API_KEY?.trim() || '';
  const mock = env.CHARACTER_MOCK === '1' || (!gemini && dev);
  return {
    gemini,
    anthropic,
    mock,
    imageModel: env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image',
    visionModel: env.GEMINI_VISION_MODEL?.trim() || 'gemini-2.5-flash'
  };
}

/** 기능이 켜져 있는지 (배포에서는 키가 있어야, 개발에서는 데모라도 됩니다). */
export function characterEnabled() {
  const c = config();
  return c.mock || Boolean(c.gemini);
}
export function characterIsMock() {
  return config().mock;
}

/** data URL → 서버가 다룰 base64. 형식과 크기를 여기서 거릅니다. */
export function parseDataImage(value: unknown): InlineImage {
  if (typeof value !== 'string' || !value) throw new CharacterError('no_image');
  if (value.length > MAX_IMAGE_DATA_LENGTH) throw new CharacterError('too_large');
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new CharacterError('bad_image');
  return { mimeType: match[1], data: match[2] };
}

/** 사진 분석. 견종 힌트(프로필의 견종)는 참고만 하고 사진이 우선입니다. */
export async function analyzeDogPhoto(
  photo: InlineImage,
  breedHint?: string,
  colorHint?: FurColorKey
): Promise<{ traits: DogTraits; provider: Provider }> {
  const c = config();
  // 데모 모드는 사진을 읽지 않으니, 브라우저가 잰 사진 색을 기본 털 색으로 씁니다.
  if (c.mock) return { traits: mockTraits(breedHint, colorHint), provider: 'mock' };
  if (!c.gemini) throw new CharacterError('not_configured');

  let raw: unknown = null;
  let provider: Provider = 'gemini';
  if (c.anthropic) {
    try {
      raw = await analyzeWithClaude(c.anthropic, photo, breedHint);
      provider = 'claude';
    } catch (error) {
      // Claude 쪽 문제로 기능이 멈추지 않게 Gemini 로 넘어갑니다. 원인은 로그에.
      console.error('[character] claude analysis failed, falling back to gemini', error);
    }
  }
  if (!raw) {
    try {
      raw = await callGeminiJson(
        c.gemini,
        c.visionModel,
        [imagePart(photo), textPart(analysisPrompt(breedHint))],
        traitsSchema,
        45_000
      );
    } catch (error) {
      throw toCharacterError(error);
    }
    if (!raw) throw new CharacterError('no_result', new Error('analysis returned no JSON'));
  }
  const traits = normalizeTraits(raw);
  // 우리 캐릭터가 있는 견종이면 key 를 붙여, 그 캐릭터를 첫 번째 참고 그림으로 씁니다.
  traits.breedKey = findBreed(traits.breedGuess)?.key ?? findBreed(breedHint ?? '')?.key ?? null;
  return { traits, provider };
}

/** 그림 생성 + 부위 탐지. */
export async function generateCharacter(
  photo: InlineImage,
  traits: DogTraits,
  expression: Expression
): Promise<{
  image: string;
  layout: CharacterLayout | null;
  /** 돌려주는 그림 자체의 털 색. 이 프리셋을 고르면 재채색하지 않아요. */
  baseColor: FurColorKey;
  provider: Provider;
  model: string;
  referenceKeys: string[];
}> {
  const c = config();
  if (c.mock) {
    // 데모: 견종 캐릭터를 그대로 주되, 그 그림의 색(baseColor)과 사진 색(traits.coatColor)이
    // 다르면 브라우저가 처음부터 사진 색으로 재채색해 보여 줍니다.
    const result = await mockCharacter(traits);
    return {
      image: `data:${result.image.mimeType};base64,${result.image.data}`,
      layout: result.layout,
      baseColor: result.baseColor,
      provider: 'mock',
      model: 'demo',
      referenceKeys: [traits.breedKey ?? 'maltese']
    };
  }
  if (!c.gemini) throw new CharacterError('not_configured');

  const referenceKeys = pickReferenceKeys(traits);
  const references = (await Promise.all(referenceKeys.map((key) => referenceImage(key)))).filter(
    (item): item is InlineImage => Boolean(item)
  );
  const parts = [
    textPart(generationPrompt(traits, expression, references.length)),
    ...references.flatMap((item, index) => [
      textPart(`Style reference ${index + 1}:`),
      imagePart(item)
    ]),
    textPart("The owner's dog photo:"),
    imagePart(photo)
  ];
  const models = [
    c.imageModel,
    ...(c.imageModel === FALLBACK_IMAGE_MODEL ? [] : [FALLBACK_IMAGE_MODEL])
  ];
  let generated: { image: InlineImage; model: string };
  try {
    generated = await callGeminiImage(c.gemini, models, parts, 120_000);
  } catch (error) {
    throw toCharacterError(error);
  }

  const layout = await detectLayout(c.gemini, c.visionModel, generated.image);
  return {
    image: `data:${generated.image.mimeType};base64,${generated.image.data}`,
    layout,
    baseColor: traits.coatColor,
    provider: 'gemini',
    model: generated.model,
    referenceKeys
  };
}

type Detection = { label: string; box_2d: number[] };

/** 그림에서 부위 위치를 찾습니다. 못 찾아도 그림은 쓸 수 있어서 오류를 삼킵니다. */
async function detectLayout(
  apiKey: string,
  model: string,
  picture: InlineImage
): Promise<CharacterLayout | null> {
  try {
    const found = await callGeminiJson<Detection[]>(
      apiKey,
      model,
      [imagePart(picture), textPart(layoutPrompt)],
      layoutSchema,
      40_000
    );
    if (!Array.isArray(found)) return null;
    const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const item of found) {
      if (
        !item ||
        typeof item.label !== 'string' ||
        !Array.isArray(item.box_2d) ||
        item.box_2d.length !== 4
      )
        continue;
      const [ymin, xmin, ymax, xmax] = item.box_2d.map(
        (n) => Math.min(1000, Math.max(0, Number(n))) / 1000
      );
      if (!(xmax > xmin && ymax > ymin) || boxes[item.label]) continue;
      boxes[item.label] = { x: xmin, y: ymin, w: xmax - xmin, h: ymax - ymin };
    }
    return validateLayout({
      head: boxes.head,
      body: boxes.body,
      eyeLeft: boxes.left_eye,
      eyeRight: boxes.right_eye,
      nose: boxes.nose,
      earLeft: boxes.left_ear,
      earRight: boxes.right_ear,
      tail: boxes.tail
    });
  } catch (error) {
    console.error('[character] layout detection failed', error);
    return null;
  }
}

/**
 * 아주 단순한 호출 횟수 제한 (인스턴스 메모리). 이 기능은 로그인 없이도 쓸 수 있어서
 * 한 주소가 비용을 마구 쓰지 못하게 최소한만 막습니다. Workers 는 인스턴스가 여럿이라
 * 완벽하지 않으니, 트래픽이 늘면 KV/Durable Object 로 옮기세요.
 */
const hits = new Map<string, number[]>();
export function throttle(key: string, limit: number, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) throw new CharacterError('rate_limited');
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
}
