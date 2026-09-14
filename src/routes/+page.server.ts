import { getPlaces } from '$lib/server/places.repository';
import type { PageServerLoad } from './$types';
import { database, authConfigured } from '$lib/server/db';
import type { DogProfile } from '$lib/domain/place';

export const load: PageServerLoad = async ({ locals }) => {
  let profile: DogProfile | null = null;
  let favorites: string[] = [];
  let accountUnavailable = locals.accountUnavailable ?? false;
  if (locals.user) {
    try {
      const sql = database();
      const [dogs, saved] = await Promise.all([
        sql`SELECT name,breed,size,weight FROM dog_profiles WHERE user_id=${locals.user.id}`,
        sql`SELECT place_id FROM favorites WHERE user_id=${locals.user.id} ORDER BY created_at DESC`
      ]);
      if (dogs[0])
        profile = {
          name: dogs[0].name as string,
          breed: dogs[0].breed as string,
          size: dogs[0].size as DogProfile['size'],
          weight: Number(dogs[0].weight)
        };
      favorites = saved.map((row) => row.place_id as string);
    } catch {
      accountUnavailable = true;
    }
  }
  return {
    places: await getPlaces(),
    user: locals.user,
    profile,
    favorites,
    authEnabled: authConfigured(),
    accountUnavailable
  };
};
