import { describe, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ database: vi.fn() }));
import { checkOrigin, hashToken, randomToken, requireUser } from './auth';
import type { RequestEvent } from '@sveltejs/kit';

describe('session and write boundaries', () => {
  it('generates distinct opaque tokens and hashes for database storage', async () => {
    const token = randomToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(randomToken()).not.toBe(token);
    expect(await hashToken(token)).not.toBe(token);
    expect(await hashToken(token)).toHaveLength(64);
  });
  it.each([null, 'https://another-site.example'])(
    'rejects a missing or foreign origin %s',
    (origin) => {
      const headers = origin ? { origin } : undefined;
      expect(() =>
        checkOrigin(
          new Request('https://app.example/api/profile', { headers }),
          'https://app.example'
        )
      ).toThrow();
    }
  );
  it('requires a server-authenticated user even on same-origin writes', () => {
    const event = {
      request: new Request('https://app.example/api/profile', {
        headers: { origin: 'https://app.example' }
      }),
      url: new URL('https://app.example'),
      locals: { user: null }
    } as unknown as RequestEvent;
    expect(() => requireUser(event)).toThrow();
  });
});
