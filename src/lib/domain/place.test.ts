import { describe, expect, it } from 'vitest';
import {
  areaLabel,
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
