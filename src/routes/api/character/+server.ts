import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { validateDogId } from '$lib/domain/profile';
import { validateCharacterInput, type DogCharacter } from '$lib/domain/character';
import type { RequestHandler } from './$types';

/** 한 계정이 둘 수 있는 캐릭터 수. 그림이 커서 반려견 수와 같게 둡니다. */
const MAX_CHARACTERS = 6;

/**
 * 캐릭터 저장·수정. id 가 오면 그 캐릭터를 고치고, 없으면 새로 만듭니다.
 * dog_id 는 내 강아지일 때만 붙입니다 — 남의 강아지 id 를 넣어도 무시돼요.
 */
export const PUT: RequestHandler = async (event) => {
  const userId = requireUser(event);
  const value = await event.request.json().catch(() => null);
  const input = validateCharacterInput(value);
  if (!input) error(400, '캐릭터 정보를 확인해 주세요.');
  const id = validateDogId((value as { id?: unknown })?.id);
  const sql = database();

  let dogId: string | null = null;
  if (input.dogId) {
    const owned =
      await sql`SELECT id FROM dog_profiles WHERE id=${input.dogId} AND user_id=${userId}`;
    dogId = owned.length ? input.dogId : null;
  }
  const traits = JSON.stringify(input.traits);
  const layout = JSON.stringify(input.layout);
  const params = JSON.stringify(input.params);

  if (id) {
    const updated = await sql`
      UPDATE dog_characters
      SET dog_id=${dogId}, final_image=${input.finalImage},
          source_image=COALESCE(${input.sourceImage ?? null}, source_image),
          character_image=COALESCE(${input.characterImage ?? null}, character_image),
          traits=${traits}::jsonb, layout=${layout}::jsonb, params=${params}::jsonb,
          expression=${input.expression}, updated_at=now()
      WHERE id=${id} AND user_id=${userId}
      RETURNING id, created_at, updated_at`;
    if (!updated.length) error(404, '수정할 캐릭터를 찾지 못했어요.');
    return json({ character: toCharacter(updated[0], input, dogId) });
  }

  const [counted] =
    await sql`SELECT count(*)::int AS n FROM dog_characters WHERE user_id=${userId}`;
  if ((counted?.n ?? 0) >= MAX_CHARACTERS) {
    // 오래된 것부터 지워서 자리를 만듭니다. 캐릭터는 다시 만들 수 있으니까요.
    await sql`
      DELETE FROM dog_characters WHERE id IN (
        SELECT id FROM dog_characters WHERE user_id=${userId} ORDER BY updated_at ASC
        LIMIT ${(counted?.n ?? 0) - MAX_CHARACTERS + 1})`;
  }
  const [row] = await sql`
    INSERT INTO dog_characters (user_id, dog_id, source_image, character_image, final_image, traits, layout, params, expression)
    VALUES (${userId}, ${dogId}, ${input.sourceImage ?? null}, ${input.characterImage ?? null}, ${input.finalImage},
            ${traits}::jsonb, ${layout}::jsonb, ${params}::jsonb, ${input.expression})
    RETURNING id, created_at, updated_at`;
  return json({ character: toCharacter(row, input, dogId) });
};

export const DELETE: RequestHandler = async (event) => {
  const userId = requireUser(event);
  const value = await event.request.json().catch(() => null);
  const id = validateDogId((value as { id?: unknown })?.id);
  if (!id) error(400, '지울 캐릭터를 찾지 못했어요.');
  const sql = database();
  const removed =
    await sql`DELETE FROM dog_characters WHERE id=${id} AND user_id=${userId} RETURNING id`;
  if (!removed.length) error(404, '지울 캐릭터를 찾지 못했어요.');
  return json({ id });
};

function toCharacter(
  row: Record<string, unknown>,
  input: ReturnType<typeof validateCharacterInput> & object,
  dogId: string | null
): DogCharacter {
  return {
    ...input,
    dogId,
    id: row.id as string,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString()
  };
}
