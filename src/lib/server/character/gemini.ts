/**
 * Gemini REST 호출 (서버 전용).
 * SDK 없이 fetch 만 써서 Cloudflare Workers 에서도 그대로 돌아갑니다.
 * - 이미지 생성: 참고 캐릭터 + 사진을 함께 넣고 그림 한 장을 받습니다.
 * - 부위 탐지 / 사진 분석: JSON 스키마로 답을 받습니다.
 */
import { CharacterError } from './errors';

export type InlineImage = { mimeType: string; data: string };
type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiResult = { text: string; image: InlineImage | null };

export async function callGemini(
  apiKey: string,
  model: string,
  parts: Part[],
  generationConfig: Record<string, unknown>,
  timeoutMs: number
): Promise<GeminiResult> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new CharacterError('timeout', error);
    throw new CharacterError('upstream', error);
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail = (body.error as { message?: string; status?: string } | undefined) ?? {};
    const cause = new Error(
      `Gemini ${model} ${response.status} ${detail.status ?? ''}: ${detail.message ?? ''}`
    );
    if (response.status === 401 || response.status === 403 || /API key/i.test(detail.message ?? ''))
      throw new CharacterError('api_key', cause);
    if (response.status === 429) throw new CharacterError('quota', cause);
    if (response.status === 404) throw new GeminiModelError(model, cause);
    if (response.status === 400) throw new GeminiRequestError(detail.message ?? '', cause);
    throw new CharacterError('upstream', cause);
  }
  const feedback = body.promptFeedback as { blockReason?: string } | undefined;
  if (feedback?.blockReason)
    throw new CharacterError('blocked', new Error(`blocked: ${feedback.blockReason}`));
  const candidate = (
    body.candidates as
      { content?: { parts?: Record<string, unknown>[] }; finishReason?: string }[] | undefined
  )?.[0];
  if (!candidate) throw new CharacterError('no_result', new Error('no candidates'));
  if (
    candidate.finishReason &&
    !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason) &&
    !candidate.content?.parts?.length
  )
    throw new CharacterError('blocked', new Error(`finishReason: ${candidate.finishReason}`));
  let text = '';
  let image: InlineImage | null = null;
  for (const part of candidate.content?.parts ?? []) {
    if (typeof part.text === 'string') text += part.text;
    const inline = (part.inlineData ?? part.inline_data) as
      { mimeType?: string; mime_type?: string; data?: string } | undefined;
    if (inline?.data && !image)
      image = { mimeType: inline.mimeType ?? inline.mime_type ?? 'image/png', data: inline.data };
  }
  return { text, image };
}

/** 모델 이름이 없을 때 (404). 예비 모델로 한 번 더 시도하려고 따로 둡니다. */
export class GeminiModelError extends Error {
  constructor(
    readonly model: string,
    cause: unknown
  ) {
    super(`model unavailable: ${model}`, { cause });
  }
}
/** 요청 형식 문제 (400). responseModalities 같은 옵션 차이를 재시도로 흡수합니다. */
export class GeminiRequestError extends Error {
  constructor(
    readonly detail: string,
    cause: unknown
  ) {
    super(`bad request: ${detail}`, { cause });
  }
}

export const image = (item: InlineImage): Part => ({
  inline_data: { mime_type: item.mimeType, data: item.data }
});
export const text = (value: string): Part => ({ text: value });

/** JSON 답을 스키마로 받는 호출. 답이 JSON 이 아니면 null. */
export async function callGeminiJson<T>(
  apiKey: string,
  model: string,
  parts: Part[],
  schema: unknown,
  timeoutMs: number
): Promise<T | null> {
  const result = await callGemini(
    apiKey,
    model,
    parts,
    { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
    timeoutMs
  );
  try {
    return JSON.parse(result.text) as T;
  } catch {
    return null;
  }
}

/** 이미지 한 장을 만드는 호출. 모델·옵션 차이는 여기서 흡수합니다. */
export async function callGeminiImage(
  apiKey: string,
  models: string[],
  parts: Part[],
  timeoutMs: number
): Promise<{ image: InlineImage; model: string }> {
  let lastError: unknown;
  for (const model of models) {
    const configs: Record<string, unknown>[] = model.startsWith('gemini-3')
      ? [
          { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: '1K' } },
          { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } }
        ]
      : [
          { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
          { responseModalities: ['TEXT', 'IMAGE'] }
        ];
    for (const config of configs) {
      try {
        const result = await callGemini(apiKey, model, parts, config, timeoutMs);
        if (result.image) return { image: result.image, model };
        lastError = new CharacterError(
          'no_result',
          new Error(`no image part; text: ${result.text.slice(0, 200)}`)
        );
        break;
      } catch (error) {
        lastError = error;
        if (error instanceof GeminiRequestError) continue; // 다음 옵션으로
        if (error instanceof GeminiModelError) break; // 다음 모델로
        throw error;
      }
    }
  }
  if (lastError instanceof CharacterError) throw lastError;
  throw new CharacterError('upstream', lastError);
}
