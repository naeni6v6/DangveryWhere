/**
 * 서비스 마스코트 '댕브리'.
 * 튜토리얼(/web/start)에서 달려와 인사를 건네고, 각 단계를 안내합니다.
 *
 * 그림은 assets/댕브리_*.png 원본에서 배경을 지워 static/mascot/ 에 투명 webp 로 두었어요.
 * (만드는 법은 static/mascot/안내.txt)
 * - 투명 배경이라 multiply 합성 없이 어디에나 얹을 수 있습니다.
 * - 서비스 워커가 static/ 을 경로 단위로 캐시하므로, 그림을 바꿀 때는 파일 이름도 같이 바꾸세요.
 */
export const MASCOT_NAME = '댕브리';

/** 손 흔드는 인사 포즈 (댕브리_인사) — 기본 마스코트 그림 */
export const MASCOT_IMAGE = '/mascot/dangbri-wave.webp';
/** 갸웃하며 물어보는 얼굴 (댕브리_궁금) — 입력 단계 안내용 */
export const MASCOT_CURIOUS = '/mascot/dangbri-curious.webp';
/** 반짝 떠오른 얼굴 (댕브리_마무리) — 등록 완료 화면용 */
export const MASCOT_FINISH = '/mascot/dangbri-finish.webp';

/**
 * 멀리서 달려오는 8프레임 (댕브리_달리기 시트).
 * 1번이 가장 멀리, 8번이 가장 가까이 온 동작이라 순서대로 틀면 달려오는 장면이 됩니다.
 * 발끝을 같은 바닥선에 맞춘 정사각 캔버스라 CSS 로 크기만 키우면 원근이 살아요.
 */
export const MASCOT_RUN_FRAMES = Array.from(
  { length: 8 },
  (_, i) => `/mascot/dangbri-run-${i + 1}.webp`
);

/** 달려오는 데 걸리는 시간(ms). 다 오면 인사 포즈로 바뀝니다. */
export const MASCOT_RUN_MS = 3000;
