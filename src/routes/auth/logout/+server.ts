import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db';
import { checkOrigin, hashToken, sessionCookie } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, cookies }) => {
  checkOrigin(request, url.origin);
  const token = cookies.get(sessionCookie);
  cookies.delete(sessionCookie, { path: '/' });
  if (token) {
    const sql = database();
    await sql`DELETE FROM app_sessions WHERE token_hash = ${await hashToken(token)}`;
  }
  return json({ ok: true });
};
