import { describe, expect, it } from 'vitest';
import { profileNotice, searchPlaces, type Place } from './place';

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
