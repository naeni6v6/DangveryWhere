import { describe, expect, it } from 'vitest';
import {
  areaLabel,
  menuGroups,
  placeMenu,
  placeArea,
  placeTheme,
  profileNotice,
  searchPlaces,
  searchPlacesByTheme,
  shortAddress,
  type Place
} from './place';

const place = {
  id: '1',
  name: '강릉 카페',
  address: '강릉시 경포로',
  category: 'food',
  sourceWeight: 10
} as Place;
const dog = { name: '두부', breed: '믹스', size: 'small' as const, weight: 10 };

describe('unverified policy matching', () => {
  it('does not promise admission at an ambiguous weight boundary', () => {
    expect(profileNotice(place, dog).kind).toBe('check');
  });
  it('flags a dog exceeding the source limit', () => {
    expect(profileNotice(place, { ...dog, weight: 10.1 }).kind).toBe('restricted');
  });
  it('does not interpret a missing limit as unrestricted', () => {
    expect(profileNotice({ ...place, sourceWeight: null }, dog).kind).toBe('check');
  });
  it('detects an explicit large-dog prohibition in the original policy', () => {
    expect(
      profileNotice(
        { ...place, sourceWeight: null, policy: '대형견, 맹견은 동반하실 수 없습니다.' },
        { ...dog, size: 'large' }
      ).kind
    ).toBe('restricted');
  });
  it('does not confuse a large-dog permission with a separate prohibition', () => {
    expect(
      profileNotice(
        { ...place, sourceWeight: null, policy: '대형견 동반 가능. 음식물 반입 금지.' },
        { ...dog, size: 'large' }
      ).kind
    ).toBe('check');
  });
  it('combines search and category filters', () => {
    expect(searchPlaces([place], '경포', 'food')).toHaveLength(1);
    expect(searchPlaces([place], '경포', 'stay')).toHaveLength(0);
  });
});

describe('cafe and restaurant split', () => {
  const cafe = { ...place, foodKind: 'cafe' } as Place;
  const restaurant = { ...place, id: '2', name: '강릉 횟집', foodKind: 'restaurant' } as Place;
  const beach = { ...place, id: '3', name: '경포해변', category: 'outdoor', foodKind: null } as Place;

  it('reads the theme from the source food tag', () => {
    expect(placeTheme(cafe)).toBe('cafe');
    expect(placeTheme(restaurant)).toBe('restaurant');
  });
  it('leaves other categories as their own theme', () => {
    expect(placeTheme(beach)).toBe('outdoor');
  });
  it('does not call an unclassified food place a cafe', () => {
    expect(placeTheme({ ...place, foodKind: null } as Place)).toBe('restaurant');
  });
  it('filters cafes and restaurants apart on the web', () => {
    const all = [cafe, restaurant, beach];
    expect(searchPlacesByTheme(all, '', 'cafe')).toEqual([cafe]);
    expect(searchPlacesByTheme(all, '', 'restaurant')).toEqual([restaurant]);
    expect(searchPlacesByTheme(all, '', 'all')).toHaveLength(3);
  });
  it('keeps them together for the mobile app', () => {
    expect(searchPlaces([cafe, restaurant, beach], '', 'food')).toHaveLength(2);
  });
});

describe('region shown on screen comes from the data', () => {
  const at = (address: string) => ({ ...place, address }) as Place;

  it('normalises the several spellings of one province', () => {
    for (const spelling of ['강원', '강원도', '강원특별자치도']) {
      expect(placeArea(at(`${spelling} 강릉시 경포로 1`))).toEqual({
        province: '강원',
        city: '강릉시'
      });
    }
    expect(placeArea(at('서울특별시 마포구 와우산로 1'))).toEqual({
      province: '서울',
      city: '마포구'
    });
  });
  it('drops the province and city from a card address', () => {
    expect(shortAddress(at('강원특별자치도 강릉시 연곡면 영진길 63 1층'))).toBe('연곡면 영진길 63 1층');
  });
  it('names one city, one province, or the whole country', () => {
    expect(areaLabel([at('강원 강릉시 경포로 1'), at('강원도 강릉시 초당로 2')])).toBe('강원 강릉시');
    expect(areaLabel([at('강원 강릉시 경포로 1'), at('강원 속초시 중앙로 2')])).toBe('강원');
    expect(areaLabel([at('강원 강릉시 경포로 1'), at('서울특별시 마포구 와우산로 2')])).toBe(
      '전국 2개 시도'
    );
    expect(areaLabel([])).toBe('');
  });
});

/** 사진·설명이 없는 공공데이터 메뉴 한 줄의 기본 모양 */
const plain = (name: string, price: string | null = null) => ({
  name,
  price,
  description: null,
  photo: null,
  signature: false
});

describe('the menu the source wrote down', () => {
  it('breaks a run-on line into items at the hyphens', () => {
    // 원본은 줄바꿈 없이 이어 붙여 옵니다 (춘천 감자밭).
    expect(menuGroups('- 감자빵- 초당옥수수빵- 감자라떼')).toEqual({
      groups: [{ title: null, items: [plain('감자빵'), plain('초당옥수수빵'), plain('감자라떼')] }],
      notes: []
    });
  });
  it('keeps the sections and splits the price off the name', () => {
    const { groups, notes } = menuGroups(
      '[음료]- 아메리카노 5,000원 - 카페라떼 5,500원 [대관]- 큰운동장 1시간 20,000원'
    );
    expect(groups).toEqual([
      { title: '음료', items: [plain('아메리카노', '5,000원'), plain('카페라떼', '5,500원')] },
      // 이름에 붙은 '1시간'까지 가격으로 끌고 오지 않습니다.
      { title: '대관', items: [plain('큰운동장 1시간', '20,000원')] }
    ]);
    expect(notes).toEqual([]);
  });
  it('leaves a name that has no price alone', () => {
    // 가격을 안 적은 가게가 대부분이고, '초코/고구마/녹차라떼' 처럼 숫자가 없어요.
    const { groups } = menuGroups('- 초코/고구마/녹차라떼- 햄치즈토스트 5.000원');
    // '5.000원' 은 원본의 오타지만 고치지 않고 그대로 보여 줍니다.
    expect(groups[0].items).toEqual([
      plain('초코/고구마/녹차라떼'),
      plain('햄치즈토스트', '5.000원')
    ]);
  });
  it("separates the shop's own note from the menu itself", () => {
    const { groups, notes } = menuGroups(
      '* 입장료가 없는 대신 1인 1음료 주문 부탁드립니다.- 아메리카노- 떡볶이'
    );
    expect(groups).toEqual([{ title: null, items: [plain('아메리카노'), plain('떡볶이')] }]);
    expect(notes).toEqual(['입장료가 없는 대신 1인 1음료 주문 부탁드립니다.']);
  });
  it('does not invent a menu where the source left the field empty', () => {
    expect(menuGroups('')).toEqual({ groups: [], notes: [] });
    expect(menuGroups('   ')).toEqual({ groups: [], notes: [] });
  });
  it('keeps a bare sentence the source wrote instead of a list', () => {
    // '변동', '매장으로 문의 필요' 처럼 기호 없이 한 줄만 적힌 원본이 있습니다.
    expect(menuGroups('변동')).toEqual({ groups: [], notes: ['변동'] });
  });
});

describe('the menu board copied from the shop', () => {
  const board = {
    source: '네이버 플레이스',
    sourceUrl: 'https://map.naver.com/p/entry/place/1',
    items: [
      {
        name: '씨월드호떡',
        price: '2,500원',
        description: '꿀 + 견과류',
        photo: '/menus/a.webp',
        signature: true
      },
      { name: '아메리카노', group: '음료' },
      { name: '카페라떼', group: '음료' }
    ]
  };
  it('shows the photo board instead of the public data when we have one', () => {
    const menu = placeMenu('- 아메리카노- 떡볶이', board);
    expect(menu.source).toEqual({
      name: '네이버 플레이스',
      url: 'https://map.naver.com/p/entry/place/1'
    });
    expect(menu.groups[0].items[0]).toEqual({
      name: '씨월드호떡',
      price: '2,500원',
      description: '꿀 + 견과류',
      photo: '/menus/a.webp',
      signature: true
    });
    // 같은 구분끼리 이어 붙습니다 (사진 없는 줄은 사진 칸 없이 글자만).
    expect(menu.groups[1]).toEqual({
      title: '음료',
      items: [plain('아메리카노'), plain('카페라떼')]
    });
  });
  it('falls back to the public data when no board was copied', () => {
    const menu = placeMenu('- 아메리카노 5,000원', null);
    expect(menu.source).toBeNull();
    expect(menu.groups).toEqual([{ title: null, items: [plain('아메리카노', '5,000원')] }]);
  });
  it('does not credit a source for a board with nothing in it', () => {
    const menu = placeMenu('- 아메리카노', { source: '네이버 플레이스', items: [] });
    expect(menu.source).toBeNull();
    expect(menu.groups[0].items).toEqual([plain('아메리카노')]);
  });
});
