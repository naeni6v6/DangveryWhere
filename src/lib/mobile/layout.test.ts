import { describe, expect, it } from 'vitest';
import {
  detailSheetHeights,
  selectedPlaceTarget,
  packChipPages,
  sheetHeights,
  snapSheetLevel
} from './layout';

describe('selected place and detail sheet layout', () => {
  it('keeps the place at one sixth of the screen above all three detail stops', () => {
    for (const [width, viewport, bottomNav] of [
      [320, 740, 68],
      [390, 844, 102],
      [740, 390, 68]
    ]) {
      const available = viewport - bottomNav;
      const point = selectedPlaceTarget(width, available, viewport);
      const stops = detailSheetHeights(available, viewport);
      expect(point.x).toBe(width / 2);
      expect(point.y).toBeCloseTo(viewport / 6);
      expect(available - stops[1]).toBeCloseTo(viewport / 3);
      expect(stops[0]).toBeLessThan(stops[1]);
      expect(stops[1]).toBeLessThan(stops[2]);
      for (const height of stops) expect(available - height).toBeGreaterThan(point.y);
    }
  });

  it('accounts for an offset map and keeps the marker inside a constrained viewport', () => {
    expect(selectedPlaceTarget(390, 700, 844, 20).y + 20).toBeCloseTo(844 / 6);
    expect(selectedPlaceTarget(320, 80, 740, 180)).toEqual({ x: 160, y: 40 });
    expect(detailSheetHeights(0, 740)).toEqual([0, 0, 0]);
  });
});

describe('mobile result sheet stops', () => {
  it('keeps three ordered stops inside both short and tall map areas', () => {
    for (const height of [180, 300, 640, 900]) {
      const stops = sheetHeights(height);
      expect(stops[0]).toBeGreaterThan(0);
      expect(stops[0]).toBeLessThan(stops[1]);
      expect(stops[1]).toBeLessThan(stops[2]);
      expect(stops[2]).toBe(height);
    }
  });
  it('settles a slow drag at the nearest stop in either direction', () => {
    const stops = sheetHeights(500);
    expect(snapSheetLevel(185, stops)).toBe(0);
    expect(snapSheetLevel(330, stops)).toBe(1);
    expect(snapSheetLevel(470, stops)).toBe(2);
  });
  it('responds to a fling without escaping the available height', () => {
    const stops = sheetHeights(500);
    expect(snapSheetLevel(330, stops, 1)).toBe(2);
    expect(snapSheetLevel(330, stops, -1)).toBe(0);
    expect(snapSheetLevel(500, stops, 50)).toBe(2);
    expect(snapSheetLevel(168, stops, -50)).toBe(0);
  });
});

describe('whole category chip pages', () => {
  it('keeps every chip in order without cutting a chip at the page boundary', () => {
    const widths = [68, 70, 71, 69, 102, 75, 98, 70, 99];
    for (const available of [206, 276, 366]) {
      const pages = packChipPages(widths, available);
      expect(pages.flat()).toEqual(widths.map((_, index) => index));
      for (const page of pages) {
        expect(
          page.reduce((sum, index) => sum + widths[index], 0) + (page.length - 1) * 6
        ).toBeLessThanOrEqual(available);
      }
    }
  });
  it('fits exact boundaries and handles empty or not-yet-measured tracks', () => {
    expect(packChipPages([70, 70, 70], 146)).toEqual([[0, 1], [2]]);
    expect(packChipPages([], 200)).toEqual([]);
    expect(packChipPages([70, 100], 0)).toEqual([[0], [1]]);
  });
});
