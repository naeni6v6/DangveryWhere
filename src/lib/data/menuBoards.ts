import type { MenuBoard } from '$lib/domain/place';
import boards from './placeMenus.json';

/**
 * 가게별 메뉴판 (장소 id → 메뉴판).
 * 공공데이터의 '이용요금' 칸에는 메뉴 이름만 줄줄이 들어 있어 사진도 설명도 없습니다.
 * 사진·설명까지 옮겨 둔 가게만 여기에 두고, 없는 가게는 공공데이터 문구를 그대로 씁니다.
 */
export const menuBoards = (boards.places ?? {}) as unknown as Record<string, MenuBoard>;

export function menuBoardOf(placeId: string): MenuBoard | null {
  return menuBoards[placeId] ?? null;
}
