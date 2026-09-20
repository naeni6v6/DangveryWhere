import { neon } from '@neondatabase/serverless';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

export function database() {
  if (!env.DATABASE_URL) error(503, '저장 기능을 준비 중이에요. 잠시 후 다시 이용해 주세요.');
  return neon(env.DATABASE_URL);
}

export const authConfigured = () => Boolean(env.DATABASE_URL);

export const kakaoAuthConfigured = () =>
  Boolean(env.DATABASE_URL && env.KAKAO_REST_API_KEY && env.APP_ORIGIN);
