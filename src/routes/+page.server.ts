import { loadAppData } from '$lib/server/account';
import type { PageServerLoad } from './$types';

// 모바일 앱 화면은 동반 장소만 다룹니다. 동물병원은 웹(PC) 전용 분류라 여기서 걸러,
// 이 화면의 '전체' 목록이 지금까지와 똑같이 보이도록 합니다.
export const load: PageServerLoad = async ({ locals }) => {
  const data = await loadAppData(locals);
  return { ...data, places: data.places.filter((place) => place.category !== 'hospital') };
};
