import { loadAppData } from '$lib/server/account';
import { readRegion } from '$lib/server/regionSelection';
import type { PageServerLoad } from './$types';

// 모바일 앱 화면은 동반 장소만 다룹니다. 동물병원은 웹(PC) 전용 분류라 여기서 걸러,
// 이 화면의 '전체' 목록이 지금까지와 똑같이 보이도록 합니다.
// 지역을 고르는 화면은 웹(PC)에만 있어서, 여기서는 거기서 고른 지역을 따라갑니다.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const data = await loadAppData(locals, readRegion(cookies));
  return { ...data, places: data.places.filter((place) => place.category !== 'hospital') };
};
