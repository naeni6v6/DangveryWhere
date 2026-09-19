import { describe, expect, it } from 'vitest';
import { photoCredit } from './region';

describe('photoCredit', () => {
  it('says nothing for photos we fetched from the Gangwon pet-travel API', () => {
    expect(photoCredit(['/places/gw-105.webp', '/places/gw-105-2.webp'])).toBeNull();
    expect(photoCredit([])).toBeNull();
  });

  it('credits the Korea Tourism Organization for any visitkorea photo', () => {
    expect(photoCredit(['https://tong.visitkorea.or.kr/cms/resource/1/1_image2_1.jpg'])).toBe(
      '사진: 한국관광공사'
    );
    expect(photoCredit(['https://cdn.visitkorea.or.kr/img/call?cmd=VIEW&id=abc'])).toBe(
      '사진: 한국관광공사'
    );
  });

  it('credits the business homepage for photos picked from its site', () => {
    expect(photoCredit(['/places/homepage/region-hongcheon-1.webp'])).toBe('사진: 업소 홈페이지');
  });

  it('lists both when a place mixes sources', () => {
    expect(
      photoCredit([
        '/places/gw-1.webp',
        'https://tong.visitkorea.or.kr/a.jpg',
        '/places/homepage/gw-1.webp'
      ])
    ).toBe('사진: 한국관광공사 · 업소 홈페이지');
  });
});
