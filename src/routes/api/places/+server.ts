import { json } from '@sveltejs/kit';
import { findPlacesByIds } from '$lib/server/regionPlaces';
import type { RequestHandler } from './$types';

/**
 * 장소 id 로 장소를 찾아 줍니다 (`/api/places?ids=a,b,c`).
 *
 * 로그인하지 않은 브라우저의 찜 목록은 이 브라우저에만 있어서, 서버가 미리 담아 줄 수 없어요.
 * 게다가 찜한 곳이 지금 보고 있는 지역 밖일 수도 있어서, 화면에 있는 목록만으로는 못 찾습니다.
 * 그래서 id 만 보내면 모든 지역에서 찾아 돌려주는 자리를 하나 둡니다.
 *
 * 공개된 장소 정보라 로그인은 필요 없습니다. 한 번에 너무 많이 묻지 못하게 수만 제한해요.
 */
const MAX_IDS = 200;

export const GET: RequestHandler = async ({ url }) => {
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);
  if (!ids.length) return json({ places: [] });
  return json({ places: await findPlacesByIds(ids) });
};
