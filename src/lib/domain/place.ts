export type Category =
  | 'all'
  | 'food'
  | 'stay'
  | 'outdoor'
  | 'activity'
  | 'hospital'
  // 박물관·미술관·문예회관. 한국문화정보원 원본에만 있는 분류라 강릉 데이터에는 없습니다.
  | 'culture'
  // 반려견을 데리고 들어갈 수 있는 매장. 관광공사 반려동물 동반여행 원본에만 있는 분류입니다.
  | 'shopping';
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
  /**
   * 원본이 적어 둔 대표 메뉴·이용요금 문구 (식당·카페에만 채웁니다).
   * 강원 반려동반관광 원본의 '이용요금' 칸이고, 가격이 함께 적힌 곳은 열에 하나 정도예요.
   * 문화정보원 출처만 있는 장소에는 이 칸 자체가 없어서 빈 문자열로 둡니다.
   */
  menu: string;
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
  culture: '문화시설',
  shopping: '쇼핑'
};

/** 웹(PC) 화면에서 쓰는 분류. 식음료만 카페/식당으로 한 단계 더 쪼갭니다. */
export type Theme =
  | 'cafe'
  | 'restaurant'
  | 'stay'
  | 'outdoor'
  | 'activity'
  | 'hospital'
  | 'culture'
  | 'shopping';
export type ThemeFilter = 'all' | Theme;

export const themeNames: Record<ThemeFilter, string> = {
  all: '전체',
  cafe: '카페',
  restaurant: '식당',
  stay: '숙소',
  outdoor: '관광·산책',
  activity: '체험',
  hospital: '동물병원',
  culture: '문화시설',
  shopping: '쇼핑'
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
 * 네이버 지도에서 이 장소를 여는 주소.
 *
 * 장소 ID 가 있어야 업소 페이지(map.naver.com/p/entry/place/<id>)로 바로 가는데, 원본 데이터
 * 어디에도 네이버 ID 가 없고 네이버 검색 API 도 ID 를 주지 않습니다. 그래서 이름에 시군구를
 * 붙인 검색 주소를 씁니다. 같은 이름의 가게가 다른 지역에 있어도 우리 지역 것이 먼저 잡혀요.
 * 네이버 지도 검색은 자동 조회를 막아 두어(캡차) ID 를 스크립트로 모을 수도 없습니다.
 */
export function naverPlaceUrl(place: Place): string {
  const { city } = placeArea(place);
  const query = [place.name.trim(), city].filter(Boolean).join(' ');
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
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

/**
 * 메뉴 한 줄. 이름 말고는 없는 경우가 대부분이라 나머지는 전부 비어 있을 수 있습니다.
 * 빈 칸은 화면에서 그 줄을 통째로 빼는 뜻이에요. 채워 넣지 않습니다.
 */
export type MenuItem = {
  name: string;
  /** '5,000원' 처럼 원본에 적힌 글자 그대로. 가격을 적어 둔 가게가 열에 하나 정도예요. */
  price: string | null;
  /** 가게가 적어 둔 메뉴 설명. 공공데이터에는 없고 메뉴판(placeMenus.json)에만 있습니다. */
  description: string | null;
  /** 메뉴 사진 주소. 없으면 사진 칸 없이 글자만 보여 줍니다. */
  photo: string | null;
  /** 가게가 '대표'로 걸어 둔 메뉴 */
  signature: boolean;
};
/** 메뉴 한 묶음. title 은 원본이 '[음료]' 처럼 구분을 지어 둔 경우에만 있습니다. */
export type MenuGroup = { title: string | null; items: MenuItem[] };
/** 메뉴판을 어디서 받아 왔는지. 사진·설명이 있는 메뉴판은 출처를 함께 밝힙니다. */
export type MenuSource = { name: string; url: string | null };
export type PlaceMenu = { groups: MenuGroup[]; notes: string[]; source: MenuSource | null };

/**
 * 이름 뒤에 붙은 가격을 떼어 냅니다. '아메리카노 5,000원' → 이름 / 가격.
 * 원본에 '5.000원' 처럼 찍힌 곳도 있어 점도 함께 받고, 글자는 고치지 않고 그대로 둡니다.
 */
function splitPrice(text: string): { name: string; price: string | null } {
  const match = text.match(/^(.*\S)\s+(\d[\d,.]*\s*원)$/);
  return match ? { name: match[1], price: match[2] } : { name: text, price: null };
}

function bareItem(text: string): MenuItem {
  return { ...splitPrice(text), description: null, photo: null, signature: false };
}

/**
 * 원본의 메뉴 문구를 화면이 쓰는 묶음으로 끊습니다.
 * 원본은 줄바꿈 없이 '[구분]', '- 항목', '* 안내' 를 이어 붙여 두었어요.
 *   "[음료]- 아메리카노 5,000원- 카페라떼 5,500원* 1인 1음료 부탁드립니다"
 * 세 기호 말고는 구분이 없어서, 그 자리에서만 끊고 글자는 원본 그대로 둡니다.
 */
export function menuGroups(menu: string): { groups: MenuGroup[]; notes: string[] } {
  const groups: MenuGroup[] = [];
  const notes: string[] = [];
  for (const [, section, marker, body] of menu.matchAll(/\[([^\]]*)\]|([-*])([^[\-*]*)/g)) {
    if (section !== undefined) {
      groups.push({ title: section.trim(), items: [] });
      continue;
    }
    const text = (body ?? '').trim();
    if (!text) continue;
    if (marker === '*') notes.push(text);
    else {
      if (!groups.length) groups.push({ title: null, items: [] });
      groups.at(-1)!.items.push(bareItem(text));
    }
  }
  // 기호 없이 한 줄만 적어 둔 원본('변동' 같은)도 버리지 않고 안내로 남깁니다.
  if (!groups.length && !notes.length && menu.trim()) notes.push(menu.trim());
  return { groups: groups.filter((group) => group.items.length), notes };
}

/**
 * 사진·설명까지 있는 메뉴판 한 장. 가게 메뉴판을 손으로 옮겨 둔 것이라
 * 공공데이터(menu 칸)와 달리 출처를 밝혀야 해서 source 를 함께 답니다.
 */
export type MenuBoard = {
  /** 어디서 옮겨 적었는지 ('네이버 플레이스' 등) */
  source: string;
  sourceUrl?: string;
  /** 옮겨 적은 날. 가격이 언제 기준인지 알려 주려고 받습니다. */
  collectedAt?: string;
  items: {
    name: string;
    price?: string;
    description?: string;
    photo?: string;
    signature?: boolean;
    /** 원본이 '[음료]' 처럼 구분을 지어 둔 경우에만 */
    group?: string;
  }[];
};

/**
 * 화면에 내보낼 메뉴 한 장을 고릅니다.
 * 사진·설명이 있는 메뉴판을 따로 옮겨 둔 가게는 그쪽을 쓰고, 없으면 공공데이터 문구를 씁니다.
 * 둘을 섞지 않는 이유는, 한 가게 메뉴가 두 출처에서 반쯤씩 나오면
 * 화면 밑의 '어디서 온 값인지' 한 줄을 정직하게 쓸 수 없기 때문이에요.
 */
export function placeMenu(menu: string, board?: MenuBoard | null): PlaceMenu {
  if (board?.items.length) {
    const groups: MenuGroup[] = [];
    for (const item of board.items) {
      const title = item.group?.trim() || null;
      if (groups.at(-1)?.title !== title) groups.push({ title, items: [] });
      groups.at(-1)!.items.push({
        name: item.name,
        price: item.price?.trim() || null,
        description: item.description?.trim() || null,
        photo: item.photo?.trim() || null,
        signature: item.signature === true
      });
    }
    return {
      groups,
      notes: [],
      source: { name: board.source, url: board.sourceUrl ?? null }
    };
  }
  return { ...menuGroups(menu), source: null };
}

export function policyLines(policy: string): string[] {
  const lines = policy
    .replace(/\*\s*반려견 동반 운영[\s\S]*$/, '')
    // 글머리표 뒤에 공백이 있거나 한글이 바로 붙은 경우만 끊습니다. 그냥 '-' 를 다 끊으면
    // 규정 문장에 적힌 전화번호(033-339-0000)가 토막 납니다.
    // regionPlaces.ts 의 policyChunks 와 같은 규칙이에요.
    .split(/\s*[-*]\s+|\s*[-*](?=[가-힣])|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  // 화면이 이 줄을 그대로 목록 키로 씁니다. 출처가 여럿이면 같은 문장이 두 번 올 수 있어
  // 여기서 접어 둡니다(원본에 두 번 적혀 있어도 규정이 두 번 보일 이유는 없어요).
  return [...new Set(lines)];
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
