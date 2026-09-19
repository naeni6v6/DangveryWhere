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
          } else if (source.provider === 'kto-pet-tour') {
            // 관광공사 원본은 규정을 칸 여러 개로 쪼개 줍니다. 동반 범위 칸은 반드시 있고,
            // 나머지 칸은 비어 있을 수 있어 합쳐서 한 문단으로 남깁니다(빈 칸을 지어내지 않음).
            expect(source.raw.pet).toBeTruthy();
            // 원본은 줄바꿈을 섞어 적어 둡니다. 공백만 정리하고 내용은 그대로 옮겼는지 봅니다.
            const raw = (source.raw.pet as Record<string, string>).acmpyPsblCpam ?? '';
            expect(source.sizeText).toBe(raw.replace(/\s+/g, ' ').trim());
            expect(source.raw.contentid).toBe(source.recordId.replace('kto-', ''));
          } else {
            expect(source.policyText).toBe(source.raw.policyCautions);
          }
        }
      }
    }
    expect(seen.size).toBe(593);
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
    expect((await loadPreparedRegion('chuncheon')).places).toHaveLength(156);
  });

  it('leaves the active Gangneung fallback unchanged', async () => {
    const places = await getPlaces();
    expect(places).toHaveLength(176);
    expect(places.every((place) => place.address.includes('강릉'))).toBe(true);
  });
});
