import { describe, expect, it } from 'vitest';
import { placeLinkFrom } from './placeLink';
import type { Place } from './place';

const place = {
  id: 'a',
  name: '서프쉑 카페',
  address: '강원도 양양군 손양면 선사유적로 316-74',
  category: 'food'
} as Place;

describe('placeLinkFrom', () => {
  it('uses the shop homepage when the build script kept one', () => {
    expect(placeLinkFrom(place, { a: 'http://example.com/' })).toEqual({
      url: 'http://example.com/',
      kind: 'homepage'
    });
  });

  it('falls back to a Naver Map search so every place still has a link', () => {
    expect(placeLinkFrom(place, {})).toEqual({
      url: 'https://map.naver.com/p/search/' + encodeURIComponent('서프쉑 카페 양양군'),
      kind: 'naver'
    });
  });
});
