import type { Cookies } from '@sveltejs/kit';
import { resolveRegionId, type RegionId } from '$lib/domain/region';

/** 어느 지역을 보고 있는지. 계정이 아니라 이 브라우저의 선택이라 쿠키에 담습니다. */
export const REGION_COOKIE = 'dangverywhere-region';
const SIX_MONTHS = 60 * 60 * 24 * 180;

/** 쿠키에 담긴 선택. 모르는 값이면 기본 지역(강릉)으로 돌립니다. */
export function readRegion(cookies: Cookies): RegionId {
  return resolveRegionId(cookies.get(REGION_COOKIE));
}

/**
 * 주소창에 ?region= 이 있으면 그 지역을, 없으면 지난번 선택을 씁니다.
 * 고른 지역을 쿠키에 담아 두어, 링크에 붙이지 않아도 /web 안에서 계속 따라오게 합니다.
 */
export function selectRegion(url: URL, cookies: Cookies): RegionId {
  const regionId = resolveRegionId(url.searchParams.get('region') ?? cookies.get(REGION_COOKIE));
  if (cookies.get(REGION_COOKIE) !== regionId)
    cookies.set(REGION_COOKIE, regionId, {
      path: '/',
      maxAge: SIX_MONTHS,
      httpOnly: true,
      sameSite: 'lax'
    });
  return regionId;
}
