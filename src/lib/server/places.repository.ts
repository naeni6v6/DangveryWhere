import snapshot from './data/gangneung.json';
import type { Place } from '$lib/domain/place';
import { env } from '$env/dynamic/private';
import { database } from './db';
import { error } from '@sveltejs/kit';

// Without credentials, keep the local UI preview available. Once configured,
// database failures must not silently show a stale snapshot as live data.
export async function getPlaces(): Promise<Place[]> {
  if (!env.DATABASE_URL) return snapshot as Place[];
  try {
    const sql = database();
    return (await sql`
      SELECT id, name, category, address, latitude, longitude, phone, description,
        policy, hours, source_url AS "sourceUrl", imported_at::text AS "importedAt",
        verified_at::text AS "verifiedAt", source_weight::float8 AS "sourceWeight"
      FROM places ORDER BY display_order, id
    `) as Place[];
  } catch {
    error(503, '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}
