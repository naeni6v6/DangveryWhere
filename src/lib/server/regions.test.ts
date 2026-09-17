import { describe, expect, it } from 'vitest';
import { getPlaces } from './places.repository';
import { isPreparedRegionId, listPreparedRegions, loadPreparedRegion } from './regions';
import { vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

describe('prepared region snapshots', () => {
  it('loads all eight complete datasets with coordinates and original provenance', async () => {
    const regions = listPreparedRegions();
    expect(regions.map((r) => r.id)).toEqual([
      'chuncheon',
      'yangyang',
      'seogwipo',
      'pyeongchang',
      'jeju-si',
      'taean',
      'hongcheon',
      'gapyeong'
    ]);
    const seen = new Set<string>();
    for (const region of regions) {
      const dataset = await loadPreparedRegion(region.id);
      expect(dataset.status).toBe('prepared');
      expect(dataset.places).toHaveLength(region.candidateCount);
      for (const place of dataset.places) {
        expect(seen.has(place.id)).toBe(false);
        seen.add(place.id);
        expect(place.regionId).toBe(region.id);
        expect(place.latitude).toBeGreaterThan(32);
        expect(place.latitude).toBeLessThan(39);
        expect(place.longitude).toBeGreaterThan(124);
        expect(place.longitude).toBeLessThan(132);
        expect(place.reviewStatus).toBe('unverified');
        expect(place.sources.length).toBeGreaterThan(0);
        for (const source of place.sources) {
          expect(source.url).toMatch(/^https:\/\//);
          expect(source.verifiedAt).toBeNull();
          expect(Object.keys(source.raw).length).toBeGreaterThan(0);
          if (source.provider === 'kcisa-pet-culture') {
            expect(source.raw['반려동물 동반 가능정보']).toBe('Y');
            expect(source.updatedAt).toBe(source.raw['최종작성일']);
            expect(source.policyText).toBe(source.raw['반려동물 제한사항']);
          } else {
            expect(source.policyText).toBe(source.raw.policyCautions);
          }
        }
      }
    }
    expect(seen.size).toBe(508);
  });

  it('preserves contradictory source statements instead of declaring indoor access', async () => {
    const dataset = await loadPreparedRegion('chuncheon');
    const place = dataset.places.find((p) => p.sources.some((s) => s.recordId === 'gw-15'));
    const source = place!.sources.find((s) => s.recordId === 'gw-15')!;
    expect(source.raw.inOutFlag).toBe('IN');
    expect(source.policyText).toContain('실외');
    expect(place).not.toHaveProperty('indoorAllowed');
  });

  it('rejects invalid names and does not share mutable snapshots between callers', async () => {
    expect(isPreparedRegionId('__proto__')).toBe(false);
    await expect(loadPreparedRegion('../gangneung')).rejects.toThrow('Unknown prepared region');
    const first = await loadPreparedRegion('chuncheon');
    first.places.length = 0;
    expect((await loadPreparedRegion('chuncheon')).places).toHaveLength(93);
  });

  it('leaves the active Gangneung fallback unchanged', async () => {
    const places = await getPlaces();
    expect(places).toHaveLength(93);
    expect(places.every((place) => place.address.includes('강릉'))).toBe(true);
  });
});
