import { getPlaces } from './places.repository';
import { database, authConfigured } from './db';
import type { DogProfile } from '$lib/domain/place';

/** Places plus the signed-in user's dog profile and favorites, shared by the mobile and web screens. */
export async function loadAppData(locals: App.Locals) {
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
}
