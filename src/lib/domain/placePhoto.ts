import placeImages from '$lib/data/placeImages.json';
import type { Place } from './place';
import { placeIdVariants } from './placeIdentity';

/** 장소 사진 (static/places 아래 경로 목록). 사진을 못 구한 곳은 빈 배열입니다. */
export function placePhotos(id: string): string[] {
  return [
    ...new Set(
      placeIdVariants(id).flatMap((key) => (placeImages as Record<string, string[]>)[key] ?? [])
    )
  ];
}

export function hasPhoto(place: Place): boolean {
  return placePhotos(place.id).length > 0;
}

/**
 * 사진이 있는 장소를 앞으로. 그 안에서는 받은 순서를 그대로 지킵니다.
 *
 * 목록 맨 위는 그 지역의 첫인상이라, 사진 한 장 없는 가게가 먼저 걸리면
 * 서비스가 텅 빈 것처럼 보입니다. 사진 없는 곳을 빼지는 않고 뒤로 미뤄요
 * (동반 규정은 사진과 상관없이 필요한 정보라 목록에는 남아 있어야 합니다).
 */
export function photoFirst<T extends Place>(places: T[]): T[] {
  const shown: T[] = [];
  const rest: T[] = [];
  for (const place of places) (hasPhoto(place) ? shown : rest).push(place);
  return [...shown, ...rest];
}
