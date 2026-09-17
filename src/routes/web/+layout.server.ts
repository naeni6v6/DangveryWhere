import { loadAppData } from '$lib/server/account';
import { selectRegion } from '$lib/server/regionSelection';
import type { LayoutServerLoad } from './$types';

// Every web(PC) page shares the same places, dog profile and favorites.
// 어느 지역을 볼지는 주소창의 ?region= 이 정하고, 없으면 지난번 선택(쿠키)을 그대로 씁니다.
export const load: LayoutServerLoad = ({ locals, url, cookies }) =>
  loadAppData(locals, selectRegion(url, cookies));
