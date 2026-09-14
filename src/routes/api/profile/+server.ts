import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { validateProfile } from '$lib/domain/profile';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
  const userId = requireUser(event);
  const value = await event.request.json().catch(() => null);
  const profile = validateProfile(value);
  if (!profile) error(400, '이름, 견종, 체급과 몸무게를 확인해 주세요.');
  const sql = database();
  await sql`INSERT INTO dog_profiles (user_id,name,breed,size,weight) VALUES (${userId},${profile.name},${profile.breed},${profile.size},${profile.weight}) ON CONFLICT (user_id) DO UPDATE SET name=excluded.name,breed=excluded.breed,size=excluded.size,weight=excluded.weight,updated_at=now()`;
  return json({ profile });
};
