import { env } from '$env/dynamic/private';
import { authConfigured } from '$lib/server/db';
import { randomToken } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies }) => {
  if (!authConfigured() || !env.APP_ORIGIN || !env.KAKAO_REST_API_KEY)
    error(503, '로그인 연결을 준비 중이에요.');
  const state = randomToken();
  const origin = new URL(env.APP_ORIGIN).origin;
  cookies.set('dw_oauth_state', state, {
    path: '/auth',
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https:'),
    maxAge: 600
  });
  const params = new URLSearchParams({
    client_id: env.KAKAO_REST_API_KEY,
    redirect_uri: `${origin}/auth/kakao/callback`,
    response_type: 'code',
    state
  });
  redirect(302, `https://kauth.kakao.com/oauth/authorize?${params}`);
};
