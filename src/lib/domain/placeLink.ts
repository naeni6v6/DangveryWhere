import placeLinks from '$lib/data/placeLinks.json';
import { naverPlaceUrl, type Place } from './place';

/**
 * '상세 정보 확인' 버튼이 여는 주소.
 *
 * homepage: 원본 데이터에 적힌 업소 홈페이지(인스타그램·블로그 포함). scripts/build-place-links.mjs 가
 *           접속되는 것만 골라 placeLinks.json 에 남깁니다.
 * naver:    홈페이지가 없거나 죽은 장소. 네이버 지도 검색으로 넘깁니다(naverPlaceUrl 참고).
 */
export type PlaceLink = { url: string; kind: 'homepage' | 'naver' };

export function placeLinkFrom(place: Place, links: Record<string, string>): PlaceLink {
  const url = links[place.id];
  return url ? { url, kind: 'homepage' } : { url: naverPlaceUrl(place), kind: 'naver' };
}

export function placeLink(place: Place): PlaceLink {
  return placeLinkFrom(place, placeLinks as Record<string, string>);
}

/** 업소 페이지로 바로 가는 링크가 있는 장소인지. 목록에서 이런 곳을 앞에 둡니다. */
export function hasDirectLink(place: Place): boolean {
  return place.id in (placeLinks as Record<string, string>);
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
