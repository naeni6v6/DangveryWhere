/**
 * 데모 모드 — AI 키가 없을 때 흐름을 끝까지 눌러 볼 수 있게 합니다.
 * 사진을 분석하는 대신 강아지 프로필의 견종으로 특징을 채우고, 그 견종의 기존 캐릭터를
 * "생성 결과"로 돌려줍니다. 화면에는 데모라고 표시돼요.
 *
 * 견종별 기본 특징·부위 위치는 브라우저도 같이 쓰므로 $lib/domain/breedCharacter.ts 에 있습니다.
 */
import {
  breedCharacterKey,
  breedCharacterTraits,
  breedLayouts,
  breedSketches
} from '$lib/domain/breedCharacter';
import { findBreed } from '$lib/domain/breeds';
import { josa } from '$lib/domain/korean';
import {
  furColorLabel,
  furColors,
  normalizeTraits,
  type CharacterLayout,
  type DogTraits,
  type FurColorKey
} from '$lib/domain/character';
import { referenceImage } from './references';
import type { InlineImage } from './gemini';

export function mockKey(breedHint?: string | null, traits?: DogTraits | null) {
  return breedCharacterKey(traits?.breedKey, traits?.breedGuess, breedHint);
}

export function mockTraits(breedHint?: string | null, colorHint?: FurColorKey): DogTraits {
  const key = mockKey(breedHint);
  const breed = findBreed(key);
  const base = breedCharacterTraits(key, 'demo mode — traits guessed from the profile breed');
  if (!colorHint) return base;
  // 브라우저가 잰 사진 색이 있으면 그걸 털 색으로. 캐릭터 그림은 나중에 그 색으로 재채색됩니다.
  // 견종 문장은 그 견종의 흔한 색을 말하니, 사진 색을 쓸 때는 한 줄을 새로 씁니다.
  return normalizeTraits({
    ...base,
    coatColor: colorHint,
    coatHex: furColors.find((c) => c.key === colorHint)?.hex,
    summaryKo: `${furColorLabel(colorHint)} 털이 예쁜 ${breed?.label ?? '아이'}${josa(breed?.label ?? '아이', '이에요/예요')}.`
  });
}

export async function mockCharacter(
  traits: DogTraits
): Promise<{ image: InlineImage; layout: CharacterLayout | null; baseColor: FurColorKey }> {
  const key = mockKey(null, traits);
  const image = (await referenceImage(key)) ?? (await referenceImage('maltese'));
  if (!image) throw new Error('reference images missing');
  return {
    image,
    layout: breedLayouts[key] ?? null,
    baseColor: breedSketches[key]?.coatColor ?? 'cream'
  };
}
