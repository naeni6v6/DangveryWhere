/**
 * Claude 로 강아지 사진을 분석합니다 (서버 전용).
 * ANTHROPIC_API_KEY 가 있을 때만 쓰이고, 없으면 Gemini 가 같은 스키마로 분석합니다.
 */
import Anthropic from '@anthropic-ai/sdk';
import { CharacterError } from './errors';
import { analysisPrompt, traitsSchema } from './prompts';
import type { InlineImage } from './gemini';

const MODEL = 'claude-opus-5';
type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export async function analyzeWithClaude(
  apiKey: string,
  photo: InlineImage,
  breedHint?: string
): Promise<unknown> {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 2048,
        // 안전 분류기가 거절하면 서버가 알아서 다른 모델로 이어 갑니다.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { format: { type: 'json_schema', schema: traitsSchema }, effort: 'low' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: photo.mimeType as MediaType,
                  data: photo.data
                }
              },
              { type: 'text', text: analysisPrompt(breedHint) }
            ]
          }
        ]
      },
      { timeout: 60_000 }
    );
  } catch (error) {
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError
    )
      throw new CharacterError('api_key', error);
    if (error instanceof Anthropic.RateLimitError) throw new CharacterError('quota', error);
    if (error instanceof Anthropic.APIConnectionTimeoutError)
      throw new CharacterError('timeout', error);
    if (error instanceof Anthropic.BadRequestError) throw new CharacterError('bad_image', error);
    throw new CharacterError('upstream', error);
  }
  if (response.stop_reason === 'refusal')
    throw new CharacterError('blocked', new Error('claude refusal'));
  const text = response.content.find((block) => block.type === 'text')?.text ?? '';
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CharacterError('no_result', error);
  }
}
