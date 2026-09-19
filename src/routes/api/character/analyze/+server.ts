import { json } from '@sveltejs/kit';
import { checkOrigin } from '$lib/server/auth';
import { furColorKeys, type FurColorKey } from '$lib/domain/character';
import { analyzeDogPhoto, characterIsMock, parseDataImage, throttle } from '$lib/server/character';
import { toCharacterError } from '$lib/server/character/errors';
import type { RequestHandler } from './$types';

/**
 * 1단계: 강아지 사진에서 특징을 읽습니다.
 * 로그인 없이도 쓸 수 있는 대신 같은 출처의 요청만 받고, 주소당 횟수를 제한합니다.
 */
export const POST: RequestHandler = async (event) => {
  checkOrigin(event.request, event.url.origin);
  try {
    throttle(`analyze:${event.getClientAddress()}`, 20);
    const body = (await event.request.json().catch(() => ({}))) as {
      image?: unknown;
      breedHint?: unknown;
      colorHint?: unknown;
    };
    const photo = parseDataImage(body.image);
    const breedHint = typeof body.breedHint === 'string' ? body.breedHint.slice(0, 40) : undefined;
    const colorHint = furColorKeys.includes(body.colorHint as FurColorKey)
      ? (body.colorHint as FurColorKey)
      : undefined;
    const result = await analyzeDogPhoto(photo, breedHint, colorHint);
    return json({ ...result, mock: characterIsMock() });
  } catch (error) {
    const failure = toCharacterError(error);
    console.error('[character] analyze failed', failure.code, failure.cause ?? failure);
    return json({ message: failure.message, code: failure.code }, { status: failure.status });
  }
};
