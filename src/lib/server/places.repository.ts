import snapshot from './data/gangneung.json';
import type { Place } from '$lib/domain/place';
import { env } from '$env/dynamic/private';
import { database } from './db';
import { error } from '@sveltejs/kit';

/**
 * 강릉 스냅샷에 들어 있는 장소 수.
 * 지역 선택 목록에서 아직 안 불러온 강릉의 개수를 보여 줄 때만 씁니다.
 * DB 를 붙이면 실제 개수가 다를 수 있어, 화면에 보이는 지역은 늘 실제 값으로 덮어씁니다.
 */
export const gangneungSnapshotCount = (snapshot as Place[]).length;

// Without credentials, keep the local UI preview available. Once configured,
// database failures must not silently show a stale snapshot as live data.
export async function getPlaces(): Promise<Place[]> {
  if (!env.DATABASE_URL) return snapshot as Place[];
  try {
    const sql = database();
    return (await sql`
      SELECT id, name, category, food_kind AS "foodKind", address, latitude, longitude,
        phone, description, policy, hours, menu, source_url AS "sourceUrl",
        imported_at::text AS "importedAt", verified_at::text AS "verifiedAt",
        source_weight::float8 AS "sourceWeight"
      FROM places ORDER BY display_order, id
    `) as Place[];
  } catch {
    error(503, '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}
