import { describe, expect, it } from 'vitest';
import { placeLinkFrom, placeLink, hasDirectLink, placeLinkLabel } from './placeLink';
import links from '$lib/data/placeLinks.json';
import reviewed from '$lib/data/reviewedPlaceLinks.json';
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

  it('rejects an ended Modoo page even when an old import still has it', () => {
    expect(placeLinkFrom(place, { a: 'https://example.modoo.at/' }).kind).toBe('naver');
    expect(Object.values(links).some((url) => new URL(url).hostname.endsWith('modoo.at'))).toBe(
      false
    );
  });

  it('keeps reviewed links and their button labels distinct from search results', () => {
    for (const [id, review] of Object.entries(reviewed)) {
      const target = { ...place, id };
      const link = placeLink(target);
      if (review.url) {
        expect(link).toEqual({ url: review.url, kind: 'naver-place' });
        expect(hasDirectLink(target)).toBe(true);
        expect(placeLinkLabel(link)).toBe('네이버 플레이스 보기');
      } else {
        expect(link.kind).toBe('naver');
        expect(hasDirectLink(target)).toBe(false);
        expect(placeLinkLabel(link)).toBe('네이버에서 장소 찾기');
      }
    }
  });

  it('resolves the old Happy Place ID to the reviewed business', () => {
    expect(placeLink({ ...place, id: 'region-yangyang-a5e930212be4313b9ef6' }).url).toBe(
      'https://m.place.naver.com/accommodation/11734270/home'
    );
  });
});
