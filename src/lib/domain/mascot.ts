/**
 * 서비스 마스코트.
 * 튜토리얼(/web/start)에서 인사를 건네고 각 단계를 안내합니다.
 *
 * 지금은 말티즈 3D 캐릭터(static/dogs/maltese.webp)를 임시로 쓰고 있어요.
 * 2D(메이플 느낌) 마스코트 그림이 준비되면 static/ 에 넣고 아래 경로만 바꾸면 됩니다.
 * - 배경이 순백(#FFFFFF)이면 multiply 합성으로 자연스럽게 지워집니다. (static/dogs/안내.txt 참고)
 * - 서비스 워커가 static/ 을 경로 단위로 캐시하므로, 그림을 바꿀 때는 파일 이름도 같이 바꾸세요.
 */
export const MASCOT_NAME = '댕브리';
export const MASCOT_IMAGE = '/dogs/maltese.webp';
