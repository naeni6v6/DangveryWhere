import { json } from '@sveltejs/kit';
import { checkOrigin } from '$lib/server/auth';
import { expressions, normalizeTraits, type Expression } from '$lib/domain/character';
import {
  characterIsMock,
  generateCharacter,
  parseDataImage,
  throttle
} from '$lib/server/character';
import { toCharacterError } from '$lib/server/character/errors';
import type { RequestHandler } from './$types';

/**
 * 2단계: 특징 + 사진 + 참고 캐릭터로 그림을 만들고 부위 위치까지 찾아 돌려줍니다.
 * 슬라이더는 브라우저에서 처리되므로 이 호출은 처음 한 번과 [AI 로 다시 생성] 때만 옵니다.
 */
export const POST: RequestHandler = async (event) => {
  checkOrigin(event.request, event.url.origin);
  try {
    throttle(`generate:${event.getClientAddress()}`, 8);
    const body = (await event.request.json().catch(() => ({}))) as {
      image?: unknown;
      traits?: unknown;
      expression?: unknown;
    };
    const photo = parseDataImage(body.image);
    const traits = normalizeTraits(body.traits);
    const expression = expressions.some((entry) => entry.key === body.expression)
      ? (body.expression as Expression)
      : 'smile';
    const result = await generateCharacter(photo, traits, expression);
    return json({ ...result, expression, mock: characterIsMock() });
  } catch (error) {
    const failure = toCharacterError(error);
    console.error('[character] generate failed', failure.code, failure.cause ?? failure);
    return json({ message: failure.message, code: failure.code }, { status: failure.status });
  }
};
