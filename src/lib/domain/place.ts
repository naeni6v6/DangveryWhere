export type Category = 'all' | 'food' | 'stay' | 'outdoor' | 'activity';
export type DogSize = 'small' | 'medium' | 'large';
export type DogProfile = { name: string; breed: string; size: DogSize; weight: number };
export type Place = {
  id: string;
  name: string;
  category: Exclude<Category, 'all'>;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  description: string;
  policy: string;
  hours: string;
  sourceUrl: string;
  importedAt: string;
  verifiedAt: string | null;
  // Source field only: an absent value is not evidence of unrestricted entry.
  sourceWeight: number | null;
};

export const categoryNames: Record<Category, string> = {
  all: '전체',
  food: '카페·음식점',
  stay: '숙소',
  outdoor: '관광·산책',
  activity: '체험'
};

export function policyLines(policy: string): string[] {
  return policy
    .replace(/\*\s*반려견 동반 운영[\s\S]*$/, '')
    .split(/(?:^|\s*)-\s*|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function searchPlaces(places: Place[], query: string, category: Category): Place[] {
  const term = query.trim().toLocaleLowerCase('ko');
  return places.filter(
    (place) =>
      (category === 'all' || place.category === category) &&
      (!term || `${place.name} ${place.address}`.toLocaleLowerCase('ko').includes(term))
  );
}

export function profileNotice(
  place: Place,
  dog: DogProfile
): { label: string; detail: string; kind: 'restricted' | 'check' } {
  const largeDogRestricted =
    /대형견(?:\s*[,·/]\s*맹견)?(?:은|는)?\s*(?:동반|출입|입장)(?:하실|할)?\s*(?:수\s*없|불가|불가능|금지|제한)/.test(
      place.policy ?? ''
    );
  const smallDogsOnly = /소형견(?:만|에\s*한해)\s*(?:동반|입장|출입)/.test(place.policy ?? '');
  if ((dog.size === 'large' && largeDogRestricted) || (dog.size !== 'small' && smallDogsOnly)) {
    return {
      label: '체급 제한 안내',
      detail: '원본 규정에 우리 강아지 체급의 동반 제한이 기재되어 있어요.',
      kind: 'restricted'
    };
  }
  if (place.sourceWeight !== null && dog.weight > place.sourceWeight) {
    return {
      label: '체중 조건 확인',
      detail: `등록한 ${dog.weight}kg이 원본의 제한 체중 ${place.sourceWeight}kg을 초과해요.`,
      kind: 'restricted'
    };
  }
  // Unreviewed public records must never produce a positive admission guarantee.
  return {
    label: '동반 조건 확인',
    detail: '체중뿐 아니라 허용 구역과 준비물을 함께 확인해 주세요.',
    kind: 'check'
  };
}
