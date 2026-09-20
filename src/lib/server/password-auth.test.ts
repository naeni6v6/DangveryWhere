import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError, type RequestEvent } from '@sveltejs/kit';

vi.mock('./db', () => ({ database: vi.fn() }));
vi.mock('./password', () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock('./account', () => ({ loadAccountData: vi.fn() }));
vi.mock('./auth', async (original) => ({
  ...(await original<typeof import('./auth')>()),
  issueSession: vi.fn()
}));

import { database } from './db';
import { hashPassword, verifyPassword } from './password';
import { issueSession } from './auth';
import { authenticateWithPassword } from './password-auth';
import { loadAccountData } from './account';

const user = { id: 'user-1', username: 'tester', nickname: '테스트 사용자' };
const account = { user, dogs: [], favorites: ['gw-1'], characters: [], accountUnavailable: false };
let attempts = 1;
let duplicate = false;
let existing = true;
let failDatabase = false;
const queries: { text: string; values: unknown[] }[] = [];
const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const text = strings.join('?');
  queries.push({ text, values });
  if (failDatabase) throw new Error('PRIVATE_DATABASE_CONNECTION_DETAIL');
  if (text.includes('INSERT INTO auth_rate_limits')) return [{ attempts }];
  if (text.includes('INSERT INTO app_users')) return duplicate ? [] : [user];
  if (text.includes('SELECT id, username'))
    return existing ? [{ ...user, password_hash: 'stored-hash' }] : [];
  return [];
});

function event(body: unknown, origin: string | null = 'https://app.example') {
  return {
    request: new Request('https://app.example/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
      body: JSON.stringify(body)
    }),
    url: new URL('https://app.example/auth/login'),
    cookies: { get: vi.fn(), set: vi.fn() },
    getClientAddress: () => '192.0.2.1'
  } as unknown as RequestEvent;
}

const credentials = {
  username: 'Tester',
  password: 'Account2026!',
  nickname: '테스트 사용자',
  passwordConfirm: 'Account2026!'
};

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  attempts = 1;
  duplicate = false;
  existing = true;
  failDatabase = false;
  vi.mocked(database).mockReturnValue(sql as unknown as ReturnType<typeof database>);
  vi.mocked(hashPassword).mockResolvedValue('salted-hash');
  vi.mocked(verifyPassword).mockResolvedValue(true);
  vi.mocked(loadAccountData).mockResolvedValue(account);
});

describe('password account endpoints', () => {
  it.each([null, 'https://foreign.example'])(
    'rejects cross-origin or missing-origin requests before any database work (%s)',
    async (origin) => {
      await expect(
        authenticateWithPassword(event(credentials, origin), 'signup')
      ).rejects.toMatchObject({ status: 403 });
      expect(sql).not.toHaveBeenCalled();
      expect(issueSession).not.toHaveBeenCalled();
    }
  );
  it('creates an account with a normalized username and a hash, then issues a secure session', async () => {
    const requestEvent = event(credentials);
    const response = await authenticateWithPassword(requestEvent, 'signup');
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(account);
    expect(queries.find((query) => query.text.includes('INSERT INTO app_users'))?.values).toEqual([
      'tester',
      'salted-hash',
      '테스트 사용자'
    ]);
    expect(issueSession).toHaveBeenCalledWith(user.id, requestEvent.cookies, true);
  });
  it('does not overwrite an existing account', async () => {
    duplicate = true;
    await expect(authenticateWithPassword(event(credentials), 'signup')).rejects.toMatchObject({
      status: 409
    });
    expect(issueSession).not.toHaveBeenCalled();
  });
  it('checks password confirmation on the server', async () => {
    await expect(
      authenticateWithPassword(
        event({ ...credentials, passwordConfirm: 'Different2026!' }),
        'signup'
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(sql).not.toHaveBeenCalled();
  });
  it('never returns the password hash after a valid login', async () => {
    const response = await authenticateWithPassword(event(credentials), 'login');
    expect(await response.json()).toEqual(account);
    expect(loadAccountData).toHaveBeenCalledWith({ user });
    expect(verifyPassword).toHaveBeenCalledWith(credentials.password, 'stored-hash');
    expect(issueSession).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    'returns the same error for a wrong password and an unknown username (existing=%s)',
    async (accountExists) => {
      existing = accountExists;
      vi.mocked(verifyPassword).mockResolvedValue(false);
      await expect(authenticateWithPassword(event(credentials), 'login')).rejects.toMatchObject({
        status: 401,
        body: { message: '아이디 또는 비밀번호가 올바르지 않아요.' }
      });
      expect(verifyPassword).toHaveBeenCalled();
      expect(issueSession).not.toHaveBeenCalled();
    }
  );
  it('limits repeated login attempts before password computation', async () => {
    attempts = 11;
    await expect(authenticateWithPassword(event(credentials), 'login')).rejects.toMatchObject({
      status: 429
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(issueSession).not.toHaveBeenCalled();
  });
  it('rejects an oversized streamed JSON payload', async () => {
    await expect(
      authenticateWithPassword(event({ ...credentials, padding: 'x'.repeat(5000) }), 'signup')
    ).rejects.toMatchObject({ status: 413 });
    expect(sql).not.toHaveBeenCalled();
  });
  it('returns a useful unavailable message without leaking database errors', async () => {
    failDatabase = true;
    try {
      await authenticateWithPassword(event(credentials), 'login');
      expect.fail('Expected a failed connection');
    } catch (failure) {
      expect(isHttpError(failure, 503)).toBe(true);
      expect(JSON.stringify(failure)).not.toContain('PRIVATE_DATABASE_CONNECTION_DETAIL');
    }
    expect(issueSession).not.toHaveBeenCalled();
  });
});
