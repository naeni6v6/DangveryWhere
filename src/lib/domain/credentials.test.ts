import { describe, expect, it } from 'vitest';
import { normalizeNickname, normalizeUsername, passwordIsValid } from './credentials';

describe('account input validation', () => {
  it('uses the same username for upper/lowercase and trims surrounding spaces', () => {
    expect(normalizeUsername('  My_Account01  ')).toBe('my_account01');
  });
  it.each([null, 42, '', 'abc', 'a'.repeat(25), '한글아이디', 'user name', 'user@example.com'])(
    'rejects invalid usernames: %s',
    (input) => expect(normalizeUsername(input)).toBeNull()
  );
  it('accepts Korean nicknames without allowing empty or oversized names', () => {
    expect(normalizeNickname('  테스트계정  ')).toBe('테스트계정');
    expect(normalizeNickname('   ')).toBeNull();
    expect(normalizeNickname('가'.repeat(21))).toBeNull();
    expect(normalizeNickname('사용자\n이름')).toBeNull();
  });
  it('rejects passwords bcrypt would silently truncate, including multibyte characters', () => {
    expect(passwordIsValid('a1' + 'x'.repeat(70))).toBe(true);
    expect(passwordIsValid('a1' + 'x'.repeat(71))).toBe(false);
    expect(passwordIsValid('a1' + '가'.repeat(24))).toBe(false);
    expect(passwordIsValid('a1' + '가'.repeat(23))).toBe(true);
  });
  it.each(['short12', 'onlyletters', '12345678', 'abcd1234\u0000', null])(
    'rejects incomplete or malformed passwords: %s',
    (input) => expect(passwordIsValid(input)).toBe(false)
  );
});
