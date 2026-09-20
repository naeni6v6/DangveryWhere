import { env } from '$env/dynamic/private';
import { database } from '$lib/server/db';
import { hashToken, sessionCookie } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  const token = event.cookies.get(sessionCookie);
  if (env.DATABASE_URL && token && /^[a-f0-9]{64}$/.test(token)) {
    try {
      const sql = database();
      const sessions = await sql`SELECT u.id, u.username, u.nickname FROM app_sessions s
          JOIN app_users u ON u.id = s.user_id
          WHERE s.token_hash = ${await hashToken(token)} AND s.expires_at > now()`;
      if (sessions[0])
        event.locals.user = {
          id: sessions[0].id as string,
          username: sessions[0].username as string | null,
          nickname: sessions[0].nickname as string
        };
      else event.cookies.delete(sessionCookie, { path: '/' });
    } catch {
      // Keep public browsing usable during a database outage; writes fail closed.
      event.locals.accountUnavailable = true;
    }
  }
  const response = await resolve(event);
  if (token || event.url.pathname.startsWith('/auth') || event.url.pathname.startsWith('/api')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
};
