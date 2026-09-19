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
 * 달려오는 18프레임 (댕브리_달리기2 시트).
 * 네 걸음 남짓이 끊김 없이 이어지도록 그려진 연속 동작이라, 1번부터 차례로 틀면 됩니다.
 * 18장 모두 같은 배율로 발끝을 같은 바닥선에 맞춰 두었으니
 * CSS 로 크기만 키우면 달려오는 원근이 얹힙니다.
 */
export const MASCOT_RUN_FRAMES = Array.from(
  { length: 18 },
  (_, i) => `/mascot/dangbri-dash-${i + 1}.webp`
);

/**
 * 달려오는 데 걸리는 시간(ms). 다 오면 인사 포즈로 바뀝니다.
 * 18프레임을 이 시간에 고르게 나눠 트니, 한 장에 약 105ms(≈9.5fps) — 클레이 애니메이션 같은 결이면서
 * 걸음이 이어져 보이는 속도예요. 늘리면 느릿느릿 끊겨 보입니다.
 */
export const MASCOT_RUN_MS = 1900;
