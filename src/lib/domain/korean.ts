/**
 * 한글 조사 고르기.
 *
 * 강아지 이름을 문장에 넣으면 받침에 따라 조사가 달라져요.
 * '두부와 함께' / '하늘과 함께' 처럼요. 이름은 사용자가 직접 넣는 값이라
 * 문구에 '와' 를 박아 두면 어떤 이름에서는 어색해집니다.
 */

/** [받침 있을 때, 받침 없을 때] */
const PARTICLES = {
  '와/과': ['과', '와'],
  '은/는': ['은', '는'],
  '이/가': ['이', '가'],
  '을/를': ['을', '를'],
  '이에요/예요': ['이에요', '예요']
} as const;

export type ParticlePair = keyof typeof PARTICLES;

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;

/** 마지막 글자에 받침이 있는지. 한글 음절이 아니면 판단하지 않고 null 을 돌려줍니다. */
export function hasFinalConsonant(word: string): boolean | null {
  const last = word.trim().at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code < HANGUL_FIRST || code > HANGUL_LAST) return null;
  return (code - HANGUL_FIRST) % 28 !== 0;
}

/**
 * 이름 뒤에 붙일 조사만 돌려줍니다. 예) josa('두부', '와/과') === '와'
 * 한글이 아닌 이름(영문·숫자 등)은 받침 없는 쪽으로 둡니다. 읽을 때 더 자연스러운 경우가 많아요.
 */
export function josa(word: string, pair: ParticlePair): string {
  const [withFinal, withoutFinal] = PARTICLES[pair];
  return hasFinalConsonant(word) ? withFinal : withoutFinal;
}
