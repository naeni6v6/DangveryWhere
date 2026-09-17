import { database, authConfigured } from './db';
import { findPlacesByIds, getRegionPlaces, listRegions } from './regionPlaces';
import { DEFAULT_REGION_ID, type RegionId } from '$lib/domain/region';
import type { Dog } from '$lib/domain/place';

/**
 * Places plus the signed-in user's dogs and favorites, shared by the mobile and web screens.
 *
 * places 는 지금 보고 있는 한 지역만 담습니다(기본은 강릉). 찜한 장소는 다른 지역에 있을 수
 * 있어서 id 로 따로 찾아 favoritePlaces 로 함께 내려, 지역을 바꿔도 찜 목록이 비지 않게 합니다.
 */
export async function loadAppData(locals: App.Locals, regionId: RegionId = DEFAULT_REGION_ID) {
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
  const places = await getRegionPlaces(regionId);
  return {
    places,
    regionId,
    regions: listRegions({ id: regionId, count: places.length }),
    favoritePlaces: await findPlacesByIds(favorites),
    user: locals.user,
    dogs,
    // 한 마리만 쓰는 화면(모바일 앱)이 그대로 동작하도록 남겨 둡니다.
    profile: dogs[0] ?? null,
    favorites,
    authEnabled: authConfigured(),
    accountUnavailable
  };
}
