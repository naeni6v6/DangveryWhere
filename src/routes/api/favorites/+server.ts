import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { findPlacesByIds } from '$lib/server/regionPlaces';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
  const userId = requireUser(event);
  const input = await event.request.json().catch(() => null);
  if (!input || typeof input.placeId !== 'string' || typeof input.saved !== 'boolean')
    error(400, '장소 정보를 확인해 주세요.');
  // 지금 보고 있는 지역만이 아니라 준비된 모든 지역에서 찾습니다.
  const [place] = await findPlacesByIds([input.placeId]);
  if (!place) error(404, '등록된 장소를 찾지 못했어요.');
  const sql = database();
  if (input.saved)
    await sql`INSERT INTO favorites (user_id,place_id) VALUES (${userId},${input.placeId}) ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM favorites WHERE user_id=${userId} AND place_id=${input.placeId}`;
  return json({ saved: input.saved });
};
