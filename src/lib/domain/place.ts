export type Category =
  | 'all'
  | 'food'
  | 'stay'
  | 'outdoor'
  | 'activity'
  | 'hospital'
  // 박물관·미술관·문예회관. 한국문화정보원 원본에만 있는 분류라 강릉 데이터에는 없습니다.
  | 'culture';
export type DogSize = 'small' | 'medium' | 'large';
export type DogProfile = { name: string; breed: string; size: DogSize; weight: number };
/**
 * 저장된 반려견 한 마리. 한 계정에 여러 마리를 둘 수 있어서 id 로 구분합니다.
 * 장소 비교(profileNotice)는 id 가 필요 없어 DogProfile 을 그대로 받습니다.
 */
export type Dog = DogProfile & { id: string };
/**
 * 원본 API 는 식음료를 하나로 묶어 주지만, 상세 데이터의 키워드 태그에 '카페'/'식당'이
 * 들어 있어 그걸로 갈라 둡니다. category 를 쪼개지 않고 별도 필드로 둔 이유는,
 * 모바일 앱(/)의 '카페·음식점' 묶음을 그대로 유지하기 위해서입니다.
 */
export type FoodKind = 'cafe' | 'restaurant';
/**
 * 원본이 적어 둔 제한 체중의 경계.
 * '10kg 미만'과 '10kg 이하'는 딱 10kg인 아이에게 정반대 답이라 구분해 둡니다.
 * 원본이 경계를 밝히지 않았으면(강릉 스냅샷·DB) 값이 비고, 그때는 '이하'로 봅니다.
 */
export type WeightBound = 'under' | 'atMost';
export type Place = {
  id: string;
  name: string;
  category: Exclude<Category, 'all'>;
  // category === 'food' 일 때만 값이 있습니다.
  foodKind: FoodKind | null;
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
  /** 원본이 '미만'/'이하'를 밝힌 경우에만 채웁니다. 비어 있으면 경계를 모른다는 뜻이에요. */
  sourceWeightBound?: WeightBound;
};

export const categoryNames: Record<Category, string> = {
  all: '전체',
  food: '카페·음식점',
  stay: '숙소',
  outdoor: '관광·산책',
  activity: '체험',
  hospital: '동물병원',
  culture: '문화시설'
};

/** 웹(PC) 화면에서 쓰는 분류. 식음료만 카페/식당으로 한 단계 더 쪼갭니다. */
export type Theme =
  | 'cafe'
  | 'restaurant'
  | 'stay'
  | 'outdoor'
  | 'activity'
  | 'hospital'
  | 'culture';
export type ThemeFilter = 'all' | Theme;

export const themeNames: Record<ThemeFilter, string> = {
  all: '전체',
  cafe: '카페',
  restaurant: '식당',
  stay: '숙소',
  outdoor: '관광·산책',
  activity: '체험',
  hospital: '동물병원',
  culture: '문화시설'
};

/**
 * 주소 앞머리에서 시도·시군구를 떼어 냅니다.
 * 같은 시도가 '강원' / '강원도' / '강원특별자치도' 처럼 섞여 들어와서 짧은 쪽으로 맞춰 둡니다.
 */
export function placeArea(place: Place): { province: string; city: string } {
  const [first = '', second = ''] = place.address.trim().split(/\s+/);
  const province = first.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, '');
  return { province, city: /(시|군|구)$/.test(second) ? second : '' };
}

/** 주소에서 시도·시군구를 떼고 남은 부분 (카드에 동네만 보여 줄 때) */
export function shortAddress(place: Place): string {
  const { city } = placeArea(place);
  return place.address
    .trim()
    .replace(/^\S+\s*/, '')
    .replace(city ? new RegExp(`^${city}\\s*`) : /^$/, '')
    .trim();
}

/**
 * 지금 데이터가 어느 지역을 담고 있는지 한 줄로. 화면 문구에 지역명을 박아 두지 않고
 * 데이터에서 끌어와, 다루는 지역이 늘어나면 문구도 따라오게 합니다.
 */
export function areaLabel(places: Place[]): string {
  const cities = new Set<string>();
  const provinces = new Set<string>();
  for (const place of places) {
    const { province, city } = placeArea(place);
    if (province) provinces.add(province);
    if (city) cities.add(`${province} ${city}`);
  }
  if (cities.size === 1) return [...cities][0];
  if (provinces.size === 1) return [...provinces][0];
  if (provinces.size === 0) return '';
  return `전국 ${provinces.size}개 시도`;
}

export function placeTheme(place: Place): Theme {
  if (place.category !== 'food') return place.category;
  // 태그가 비어 있던 과거 데이터는 식당으로 둡니다(카페로 잘못 넣는 것보다 안전).
  return place.foodKind === 'cafe' ? 'cafe' : 'restaurant';
}

export function policyLines(policy: string): string[] {
  return policy
    .replace(/\*\s*반려견 동반 운영[\s\S]*$/, '')
    .split(/(?:^|\s*)-\s*|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesTerm(place: Place, term: string): boolean {
  return !term || `${place.name} ${place.address}`.toLocaleLowerCase('ko').includes(term);
}

/** 모바일 앱(/) 용. 식음료는 카페·식당을 한 묶음으로 봅니다. */
export function searchPlaces(places: Place[], query: string, category: Category): Place[] {
  const term = query.trim().toLocaleLowerCase('ko');
  return places.filter(
    (place) =>
      (category === 'all' || place.category === category) && matchesTerm(place, term)
  );
}

/** 웹(PC) 용. 카페와 식당을 따로 고를 수 있습니다. */
export function searchPlacesByTheme(places: Place[], query: string, theme: ThemeFilter): Place[] {
  const term = query.trim().toLocaleLowerCase('ko');
  return places.filter(
    (place) => (theme === 'all' || placeTheme(place) === theme) && matchesTerm(place, term)
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
  // '10kg 미만'이면 딱 10kg인 아이도 못 들어갑니다. 경계를 모르면 '이하'로 봅니다.
  const overWeight =
    place.sourceWeight !== null &&
    (place.sourceWeightBound === 'under'
      ? dog.weight >= place.sourceWeight
      : dog.weight > place.sourceWeight);
  if (overWeight) {
    return {
      label: '체중 조건 확인',
      detail:
        place.sourceWeightBound === 'under'
          ? `원본의 제한 체중이 ${place.sourceWeight}kg 미만이라 ${dog.weight}kg은 기준을 넘어요.`
          : `등록한 ${dog.weight}kg이 원본의 제한 체중 ${place.sourceWeight}kg을 초과해요.`,
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
