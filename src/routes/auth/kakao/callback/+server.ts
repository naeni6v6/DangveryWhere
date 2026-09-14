import { env } from '$env/dynamic/private';
import { database, authConfigured } from '$lib/server/db';
import { issueSession } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, fetch }) => {
  if (!authConfigured() || !env.APP_ORIGIN || !env.KAKAO_REST_API_KEY)
    error(503, '로그인 연결을 준비 중이에요.');
  const expected = cookies.get('dw_oauth_state');
  cookies.delete('dw_oauth_state', { path: '/auth' });
  const state = url.searchParams.get('state');
  if (!expected || !state || expected !== state)
    error(400, '로그인 요청이 만료됐어요. 다시 시도해 주세요.');
  if (url.searchParams.has('error')) redirect(303, '/?auth=cancelled');
  const code = url.searchParams.get('code');
  if (!code) error(400, '로그인 코드를 확인할 수 없어요.');
  const origin = new URL(env.APP_ORIGIN).origin;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.KAKAO_REST_API_KEY,
    redirect_uri: `${origin}/auth/kakao/callback`,
    code
  });
  if (env.KAKAO_CLIENT_SECRET) params.set('client_secret', env.KAKAO_CLIENT_SECRET);
  const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  if (!tokenResponse.ok) error(502, '카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.');
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) error(502, '카카오 인증 응답을 확인할 수 없어요.');
  const accountResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  if (!accountResponse.ok) error(502, '계정 정보를 확인하지 못했어요.');
  const account = (await accountResponse.json()) as { id?: number };
  if (!account.id || !Number.isSafeInteger(account.id))
    error(502, '계정 식별자를 확인하지 못했어요.');
  const sql = database();
  const users =
    await sql`INSERT INTO app_users (kakao_id) VALUES (${String(account.id)}) ON CONFLICT (kakao_id) DO UPDATE SET kakao_id = excluded.kakao_id RETURNING id`;
  // Kakao tokens and optional profile/email fields are not persisted.
  await issueSession(users[0].id as string, cookies, origin.startsWith('https:'));
  redirect(303, '/');
};
