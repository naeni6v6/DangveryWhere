import { getPlaces } from './places.repository';
import { database, authConfigured } from './db';
import type { Dog } from '$lib/domain/place';

/** Places plus the signed-in user's dogs and favorites, shared by the mobile and web screens. */
export async function loadAppData(locals: App.Locals) {
  let dogs: Dog[] = [];
  let favorites: string[] = [];
  let accountUnavailable = locals.accountUnavailable ?? false;
  if (locals.user) {
    try {
      const sql = database();
      const [rows, saved] = await Promise.all([
        sql`SELECT id,name,breed,size,weight FROM dog_profiles
            WHERE user_id=${locals.user.id} ORDER BY created_at, id`,
        sql`SELECT place_id FROM favorites WHERE user_id=${locals.user.id} ORDER BY created_at DESC`
      ]);
      dogs = rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        breed: row.breed as string,
        size: row.size as Dog['size'],
        weight: Number(row.weight)
      }));
      favorites = saved.map((row) => row.place_id as string);
    } catch {
      accountUnavailable = true;
    }
  }
  return {
    places: await getPlaces(),
    user: locals.user,
    dogs,
    // 한 마리만 쓰는 화면(모바일 앱)이 그대로 동작하도록 남겨 둡니다.
    profile: dogs[0] ?? null,
    favorites,
    authEnabled: authConfigured(),
    accountUnavailable
  };
}
