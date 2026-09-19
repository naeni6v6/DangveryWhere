/**
 * 캐릭터 생성 중 생기는 오류. 사용자에게는 message 만 보여 주고,
 * 원인(cause)은 서버 로그에서만 봅니다.
 */
export type CharacterErrorCode =
  | 'no_image'
  | 'bad_image'
  | 'too_large'
  | 'not_configured'
  | 'api_key'
  | 'quota'
  | 'rate_limited'
  | 'timeout'
  | 'blocked'
  | 'no_result'
  | 'upstream';

const messages: Record<CharacterErrorCode, [number, string]> = {
  no_image: [400, '강아지 사진을 먼저 올려 주세요.'],
  bad_image: [400, '사진을 읽지 못했어요. JPG 나 PNG 사진으로 다시 올려 주세요.'],
  too_large: [413, '사진이 너무 커요. 조금 작은 사진으로 다시 올려 주세요.'],
  not_configured: [503, '캐릭터 만들기 기능을 준비 중이에요. 잠시 후 다시 이용해 주세요.'],
  api_key: [503, 'AI 연결 설정에 문제가 있어요. 관리자에게 알려 주세요.'],
  quota: [503, '지금은 만들 수 있는 횟수를 다 썼어요. 잠시 후 다시 시도해 주세요.'],
  rate_limited: [429, '너무 많이 시도했어요. 잠시 쉬었다가 다시 만들어 주세요.'],
  timeout: [504, '캐릭터를 만드는 데 시간이 너무 오래 걸렸어요. 다시 한 번 시도해 주세요.'],
  blocked: [
    422,
    '이 사진으로는 캐릭터를 만들지 못했어요. 강아지가 잘 보이는 다른 사진으로 해 주세요.'
  ],
  no_result: [502, '캐릭터가 나오지 않았어요. 다시 한 번 만들어 볼까요?'],
  upstream: [502, 'AI 서버가 응답하지 않아요. 잠시 후 다시 시도해 주세요.']
};

export class CharacterError extends Error {
  readonly code: CharacterErrorCode;
  readonly status: number;
  constructor(code: CharacterErrorCode, cause?: unknown) {
    super(messages[code][1], { cause });
    this.name = 'CharacterError';
    this.code = code;
    this.status = messages[code][0];
  }
}

/** 어떤 오류든 사용자에게 보여 줄 수 있는 형태로 */
export function toCharacterError(error: unknown, fallback: CharacterErrorCode = 'upstream') {
  if (error instanceof CharacterError) return error;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
    return new CharacterError('timeout', error);
  return new CharacterError(fallback, error);
}
