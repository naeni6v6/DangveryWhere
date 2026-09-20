import { database, authConfigured, kakaoAuthConfigured } from './db';
import { findPlacesByIds, getRegionPlaces, listRegions } from './regionPlaces';
import { DEFAULT_REGION_ID, type RegionId } from '$lib/domain/region';
import type { Dog } from '$lib/domain/place';
import type { DogCharacter } from '$lib/domain/character';

/**
 * Places plus the signed-in user's dogs and favorites, shared by the mobile and web screens.
 *
 * places 는 지금 보고 있는 한 지역만 담습니다(기본은 강릉). 찜한 장소는 다른 지역에 있을 수
 * 있어서 id 로 따로 찾아 favoritePlaces 로 함께 내려, 지역을 바꿔도 찜 목록이 비지 않게 합니다.
 */
export async function loadAccountData(locals: App.Locals) {
  let dogs: Dog[] = [];
  let favorites: string[] = [];
  let characters: DogCharacter[] = [];
  let accountUnavailable = locals.accountUnavailable ?? false;
  if (locals.user) {
    try {
      const sql = database();
      const [rows, saved, drawn] = await Promise.all([
        sql`SELECT id,name,breed,size,weight FROM dog_profiles
            WHERE user_id=${locals.user.id} ORDER BY created_at, id`,
        sql`SELECT place_id FROM favorites WHERE user_id=${locals.user.id} ORDER BY created_at DESC`,
        // 캐릭터는 최종 그림만 내립니다. 원본 사진·기본 그림은 다시 꾸밀 때만 필요해서요.
        // 표가 아직 없으면(마이그레이션 전) 빈 목록으로 두고 나머지는 그대로 씁니다.
        sql`SELECT id, dog_id, final_image, traits, layout, params, expression, created_at, updated_at
            FROM dog_characters WHERE user_id=${locals.user.id} ORDER BY updated_at DESC`.catch(
          () => []
        )
      ]);
      dogs = rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        breed: row.breed as string,
        size: row.size as Dog['size'],
        weight: Number(row.weight)
      }));
      favorites = saved.map((row) => row.place_id as string);
      characters = (drawn as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        dogId: (row.dog_id as string | null) ?? null,
        finalImage: row.final_image as string,
        traits: row.traits as DogCharacter['traits'],
        layout: row.layout as DogCharacter['layout'],
        params: row.params as DogCharacter['params'],
        expression: row.expression as DogCharacter['expression'],
        createdAt: new Date(row.created_at as string).toISOString(),
        updatedAt: new Date(row.updated_at as string).toISOString()
      }));
    } catch {
      accountUnavailable = true;
    }
  }
  return { user: locals.user, dogs, characters, favorites, accountUnavailable };
}

export async function loadAppData(locals: App.Locals, regionId: RegionId = DEFAULT_REGION_ID) {
  const [account, places] = await Promise.all([loadAccountData(locals), getRegionPlaces(regionId)]);
  return {
    ...account,
    places,
    regionId,
    regions: listRegions({ id: regionId, count: places.length }),
    favoritePlaces: await findPlacesByIds(account.favorites),
    // 한 마리만 쓰는 화면(모바일 앱)이 그대로 동작하도록 남겨 둡니다.
    profile: account.dogs[0] ?? null,
    authEnabled: authConfigured(),
    kakaoEnabled: kakaoAuthConfigured()
  };
}
