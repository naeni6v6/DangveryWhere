import { database } from './db';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export const sessionCookie = 'dw_session';
export async function hashToken(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}
export function checkOrigin(request: Request, origin: string) {
  if (request.headers.get('origin') !== origin) error(403, '허용되지 않은 요청이에요.');
}
export function requireUser(event: RequestEvent): string {
  checkOrigin(event.request, event.url.origin);
  if (!event.locals.user) error(401, '로그인이 필요해요.');
  return event.locals.user.id;
}
export async function issueSession(userId: string, cookies: Cookies, secure: boolean) {
  const token = randomToken();
  const sql = database();
  const previous = cookies.get(sessionCookie);
  const queries = [
    sql`INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (${await hashToken(token)}, ${userId}, now() + interval '14 days')`
  ];
  if (previous && /^[a-f0-9]{64}$/.test(previous))
    queries.push(sql`DELETE FROM app_sessions WHERE token_hash=${await hashToken(previous)}`);
  await sql.transaction(queries);
  cookies.set(sessionCookie, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 60 * 60 * 24 * 14
  });
}
