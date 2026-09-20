import placeLinks from '$lib/data/placeLinks.json';
import reviewedLinks from '$lib/data/reviewedPlaceLinks.json';
import { naverPlaceUrl, type Place } from './place';
import { canonicalPlaceId } from './placeIdentity';

/**
 * '상세 정보 확인' 버튼이 여는 주소.
 *
 * homepage: 원본 데이터에 적힌 업소 홈페이지(인스타그램·블로그 포함). scripts/build-place-links.mjs 가
 *           접속되는 것만 골라 placeLinks.json 에 남깁니다.
 * naver:    홈페이지가 없거나 죽은 장소. 네이버 지도 검색으로 넘깁니다(naverPlaceUrl 참고).
 */
export type PlaceLink = { url: string; kind: 'homepage' | 'naver-place' | 'naver' };

export function placeLinkFrom(place: Place, links: Record<string, string>): PlaceLink {
  const url = links[place.id];
  if (url) {
    try {
      const parsed = new URL(url);
      // Modoo returns HTTP 200 even though the service has ended.
      if (/^https?:$/.test(parsed.protocol) && !/(^|\.)modoo\.at$/i.test(parsed.hostname)) {
        return {
          url,
          kind: /(^|\.)place\.naver\.com$/i.test(parsed.hostname) ? 'naver-place' : 'homepage'
        };
      }
    } catch {
      /* Invalid imported URL: use the explicitly labelled search action. */
    }
  }
  return { url: naverPlaceUrl(place), kind: 'naver' };
}

export function placeLink(place: Place): PlaceLink {
  const id = canonicalPlaceId(place.id);
  const reviewed = (reviewedLinks as Record<string, { url: string | null }>)[id];
  return placeLinkFrom(
    { ...place, id },
    reviewed ? (reviewed.url ? { [id]: reviewed.url } : {}) : (placeLinks as Record<string, string>)
  );
}

export function placeLinkLabel(link: PlaceLink): string {
  return link.kind === 'naver-place'
    ? '네이버 플레이스 보기'
    : link.kind === 'naver'
      ? '네이버에서 장소 찾기'
      : '업체 페이지 보기';
}

/** 업소 페이지로 바로 가는 링크가 있는 장소인지. 목록에서 이런 곳을 앞에 둡니다. */
export function hasDirectLink(place: Place): boolean {
  return placeLink(place).kind !== 'naver';
}

/**
 * 업소 링크가 있는 장소를 앞으로. 그 안에서는 원래 순서를 지킵니다.
 * (모든 장소에 업소 페이지를 달 수 없어서, 달린 곳이 먼저 보이게 해 달라는 요청.)
 */
export function directLinkFirst<T extends Place>(places: T[]): T[] {
  const linked: T[] = [];
  const rest: T[] = [];
  for (const place of places) (hasDirectLink(place) ? linked : rest).push(place);
  return [...linked, ...rest];
}
