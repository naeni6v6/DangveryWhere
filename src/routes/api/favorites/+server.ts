import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { getPlaces } from '$lib/server/places.repository';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
  const userId = requireUser(event);
  const input = await event.request.json().catch(() => null);
  if (!input || typeof input.placeId !== 'string' || typeof input.saved !== 'boolean')
    error(400, '장소 정보를 확인해 주세요.');
  const places = await getPlaces();
  if (!places.some((place) => place.id === input.placeId))
    error(404, '등록된 장소를 찾지 못했어요.');
  const sql = database();
  if (input.saved)
    await sql`INSERT INTO favorites (user_id,place_id) VALUES (${userId},${input.placeId}) ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM favorites WHERE user_id=${userId} AND place_id=${input.placeId}`;
  return json({ saved: input.saved });
};
