/**
 * 처음 한 번만 보여 주는 튜토리얼(/web/start)의 완료 여부.
 * 계정이 없어도 동작해야 해서 이 브라우저(localStorage)에만 남깁니다.
 * 다시 보고 싶으면 /web/start?replay 로 들어가면 돼요.
 */
const TUTORIAL_KEY = 'dangverywhere-tutorial-done';

export const TUTORIAL_PATH = '/web/start';
/** 튜토리얼을 마친 뒤, 그리고 이미 마친 사람이 [시작하기]를 눌렀을 때 가는 곳 */
export const AFTER_TUTORIAL_PATH = '/web/explore';

export function isTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    // 저장이 막혀 있으면 다음 방문에 한 번 더 보여 줄 뿐이에요.
  }
}
