import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { MAX_DOGS, validateDogId, validateProfile } from '$lib/domain/profile';
import type { RequestHandler } from './$types';

/**
 * 반려견 등록·수정. id 가 오면 그 아이를 고치고, 없으면 새로 추가합니다.
 * 수정·삭제 질의에는 반드시 user_id 를 함께 넣어, 남의 아이를 건드릴 수 없게 합니다.
 */
export const PUT: RequestHandler = async (event) => {
  const userId = requireUser(event);
  const value = await event.request.json().catch(() => null);
  const profile = validateProfile(value);
  if (!profile) error(400, '이름, 견종, 체급과 몸무게를 확인해 주세요.');
  const id = validateDogId((value as { id?: unknown })?.id);
  const sql = database();

  if (id) {
    const updated = await sql`
      UPDATE dog_profiles
      SET name=${profile.name}, breed=${profile.breed}, size=${profile.size},
          weight=${profile.weight}, updated_at=now()
      WHERE id=${id} AND user_id=${userId}
      RETURNING id`;
    if (!updated.length) error(404, '수정할 강아지를 찾지 못했어요.');
    return json({ dog: { ...profile, id } });
  }

  const [counted] = await sql`SELECT count(*)::int AS n FROM dog_profiles WHERE user_id=${userId}`;
  if ((counted?.n ?? 0) >= MAX_DOGS) error(409, `강아지는 ${MAX_DOGS}마리까지 등록할 수 있어요.`);
  const [row] = await sql`
    INSERT INTO dog_profiles (user_id,name,breed,size,weight)
    VALUES (${userId},${profile.name},${profile.breed},${profile.size},${profile.weight})
    RETURNING id`;
  return json({ dog: { ...profile, id: row.id as string } });
};

export const DELETE: RequestHandler = async (event) => {
  const userId = requireUser(event);
  const value = await event.request.json().catch(() => null);
  const id = validateDogId((value as { id?: unknown })?.id);
  if (!id) error(400, '지울 강아지를 찾지 못했어요.');
  const sql = database();
  const removed = await sql`
    DELETE FROM dog_profiles WHERE id=${id} AND user_id=${userId} RETURNING id`;
  if (!removed.length) error(404, '지울 강아지를 찾지 못했어요.');
  return json({ id });
};
