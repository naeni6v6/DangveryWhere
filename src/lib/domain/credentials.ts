export const USERNAME_HINT = '영문 소문자, 숫자, 밑줄(_)로 4~24자';
export const PASSWORD_HINT = '영문과 숫자를 포함해 8자 이상 (최대 72바이트)';

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const username = value.trim().toLowerCase();
  return /^[a-z0-9_]{4,24}$/.test(username) ? username : null;
}

export function passwordIsValid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= 72 &&
    new TextEncoder().encode(value).length <= 72 &&
    /[a-zA-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export function normalizeNickname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const nickname = value.trim();
  return [...nickname].length >= 1 &&
    [...nickname].length <= 20 &&
    !/[\u0000-\u001f\u007f]/.test(nickname)
    ? nickname
    : null;
}
