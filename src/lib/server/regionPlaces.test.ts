import { describe, expect, it, vi } from 'vitest';
import { profileNotice, type DogProfile, type Place } from '$lib/domain/place';
import { DEFAULT_REGION_ID, dataRegions, groupedRegions, regionCatalog } from '$lib/domain/region';
import { loadPreparedRegion } from './regions';
import {
  findPlacesByIds,
  foodKindOf,
  getRegionPlaces,
  menuOf,
  listRegions,
  parseSourceWeight,
  policyChunks,
  regionOfPlaceId,
  sizeClassLine,
  toPlace
} from './regionPlaces';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const preparedIds = regionCatalog
  .filter((region) => region.status === 'prepared')
  .map((region) => region.id);

describe('source weight is copied, never invented', () => {
  it('leaves an empty or non-numeric limit unknown', () => {
    expect(parseSourceWeight('')).toBeNull();
    expect(parseSourceWeight('모두 가능')).toBeNull();
    expect(parseSourceWeight('해당없음')).toBeNull();
    expect(parseSourceWeight('소형/중형')).toBeNull();
  });
  it('keeps 미만 and 이하 apart', () => {
    expect(parseSourceWeight('10kg 미만')).toEqual({ weight: 10, bound: 'under' });
    expect(parseSourceWeight('10kg 이하')).toEqual({ weight: 10, bound: 'atMost' });
    expect(parseSourceWeight('5KG 미만')).toEqual({ weight: 5, bound: 'under' });
  });
  it('reads the boundary from the policy sentence when the field is a bare number', () => {
    expect(parseSourceWeight('10', '- 10kg미만 리드줄 착용 시 입장 가능합니다')).toEqual({
      weight: 10,
      bound: 'under'
    });
    expect(parseSourceWeight('10', '- 리드줄 착용 필수')).toEqual({ weight: 10 });
  });
  it('does not borrow a boundary that belongs to another measurement', () => {
    expect(parseSourceWeight('10kg, 체고 40cm 이하')).toEqual({ weight: 10 });
  });
  it('turns a size class into a sentence the dog notice already understands', () => {
    const dog: DogProfile = { name: '두부', breed: '믹스', size: 'large', weight: 28 };
    const asPolicy = (sizeText: string) =>
      ({ policy: sizeClassLine(sizeText) ?? '', sourceWeight: null }) as Place;
    expect(profileNotice(asPolicy('소형/중형'), dog).kind).toBe('restricted');
    expect(profileNotice(asPolicy('소형'), { ...dog, size: 'medium' }).kind).toBe('restricted');
    expect(sizeClassLine('모두 가능')).toBeNull();
    expect(sizeClassLine('소형/중형/대형')).toBeNull();
  });
});

describe('a dog exactly at the limit', () => {
  const place = { sourceWeight: 10, policy: '' } as Place;
  const dog: DogProfile = { name: '두부', breed: '믹스', size: 'small', weight: 10 };

  it('is refused where the source says 미만', () => {
    expect(profileNotice({ ...place, sourceWeightBound: 'under' }, dog).kind).toBe('restricted');
  });
  it('is still only asked to check where the source says 이하 or stays silent', () => {
    expect(profileNotice({ ...place, sourceWeightBound: 'atMost' }, dog).kind).toBe('check');
    expect(profileNotice(place, dog).kind).toBe('check');
  });
});

describe('policy text keeps what the sources actually wrote', () => {
  it('splits both bullet styles and drops the boilerplate footer', () => {
    expect(
      policyChunks('- 리드줄 필수입니다- 대형견은 동반 불가* 반려견 동반 운영 정책은 변동됩니다.')
    ).toEqual(['리드줄 필수입니다', '대형견은 동반 불가']);
  });

  it('labels each provider when two of them disagree', async () => {
    const dataset = await loadPreparedRegion('chuncheon');
    const conflicting = dataset.places.find((place) => place.sources.length > 1)!;
    const policy = toPlace(conflicting, dataset.collectedAt).policy;
    expect(policy).toContain('[강원 반려동반관광]');
    expect(policy).toContain('[한국문화정보원]');
  });

  it('never turns an indoor flag into permission to go inside', async () => {
    const dataset = await loadPreparedRegion('chuncheon');
    const outdoorOnly = dataset.places.find((place) =>
      place.sources.some((source) => source.recordId === 'gw-15')
    )!;
    const place = toPlace(outdoorOnly, dataset.collectedAt);
    expect(place.policy).toContain('실외');
    expect(place.policy).not.toMatch(/실내.*(가능|허용)/);
  });

  it('says so plainly when a source left the rules blank', async () => {
    const dataset = await loadPreparedRegion('yangyang');
    const blank = dataset.places.find((place) =>
      place.sources.every((source) => !source.policyText.trim() && !source.sizeText.trim())
    );
    if (blank) expect(toPlace(blank, dataset.collectedAt).policy).toContain('전화로 확인');
  });
});

describe('converted places fit the model the screens already use', () => {
  it('fills every field explicitly and never claims a verification date', async () => {
    for (const regionId of preparedIds) {
      const places = await getRegionPlaces(regionId);
      const region = regionCatalog.find((item) => item.id === regionId)!;
      for (const place of places) {
        expect(place.verifiedAt).toBeNull();
        // 수집일이지 규정 확인일이 아닙니다.
        expect(place.importedAt).toBe('2026-09-17');
        expect(place.sourceUrl).toMatch(/^https:\/\//);
        expect(typeof place.description).toBe('string');
        expect(place.policy.length).toBeGreaterThan(0);
        expect(place.foodKind === null || place.category === 'food').toBe(true);
        expect(place.address).toContain(region.city);
        if (place.sourceWeight !== null) expect(place.sourceWeight).toBeGreaterThan(0);
      }
    }
  });

  it('splits cafes from restaurants using the original tags', async () => {
    const dataset = await loadPreparedRegion('chuncheon');
    const byName = (name: string) => dataset.places.find((place) => place.name === name)!;
    expect(foodKindOf(byName('감자밭'))).toBe('cafe');
    expect(foodKindOf(byName('춘천통나무집닭갈비'))).toBe('restaurant');
    // 분류가 없는 장소는 카페라고 부르지 않습니다.
    expect(foodKindOf(byName('의암호스카이워크'))).toBeNull();
  });

  it('carries the culture category the original data added', async () => {
    const places = await getRegionPlaces('chuncheon');
    expect(places.some((place) => place.category === 'culture')).toBe(true);
  });

  it('copies the menu the source wrote, and only for places that serve one', async () => {
    const dataset = await loadPreparedRegion('chuncheon');
    const byName = (name: string) => dataset.places.find((place) => place.name === name)!;
    expect(menuOf(byName('감자밭'))).toContain('감자빵');
    // 원본의 같은 칸이 숙소에는 객실 요금, 관광지에는 입장료로 들어옵니다. 메뉴로 부르면 안 돼요.
    expect(menuOf(byName('남이섬'))).toBe('');
    for (const place of dataset.places)
      if (place.category !== 'food') expect(menuOf(place)).toBe('');
  });

  it('leaves the menu empty rather than guessing when the source has no such field', async () => {
    // 문화정보원 출처만 있는 가게에는 이용요금 칸 자체가 없습니다.
    const dataset = await loadPreparedRegion('yangyang');
    const cultureOnly = dataset.places.filter(
      (place) =>
        place.category === 'food' &&
        place.sources.every((source) => source.provider === 'kcisa-pet-culture')
    );
    expect(cultureOnly.length).toBeGreaterThan(0);
    for (const place of cultureOnly) expect(menuOf(place)).toBe('');
  });

  it('hands out the same objects instead of re-reading the snapshot', async () => {
    expect(await getRegionPlaces('hongcheon')).toBe(await getRegionPlaces('hongcheon'));
  });
});

describe('region catalog matches the data it describes', () => {
  it('centres each region on its own places', async () => {
    for (const region of regionCatalog) {
      if (region.status !== 'prepared') continue;
      const dataset = await loadPreparedRegion(region.id);
      const lats = dataset.places.map((place) => place.latitude);
      const lngs = dataset.places.map((place) => place.longitude);
      const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      expect(region.center.lat).toBeCloseTo(lat, 3);
      expect(region.center.lng).toBeCloseTo(lng, 3);
    }
  });

  it('names the providers each region was actually built from', async () => {
    for (const region of regionCatalog) {
      if (region.status !== 'prepared') continue;
      const dataset = await loadPreparedRegion(region.id);
      const providers = new Set(
        dataset.places.flatMap((place) => place.sources.map((source) => source.provider))
      );
      expect([...region.sources].sort()).toEqual([...providers].sort());
    }
  });

  it('offers the whole province first, then the five real regions', () => {
    const regions = listRegions();
    expect(regions[0].id).toBe('all');
    expect(regions).toHaveLength(6);
    expect(regions.filter((region) => region.status === 'prepared')).toHaveLength(4);
    // 강원 밖은 목록에 없습니다. 저장본이 남아 있어도 화면에 나오면 안 돼요.
    expect(regions.every((region) => region.province === '강원')).toBe(true);
    // 강원 전체는 나머지를 합친 값이라 두 번 세지 않습니다.
    expect(regions[0].placeCount).toBe(255 + 93);
    expect(
      regions
        .filter((region) => region.status !== 'mixed')
        .reduce((sum, region) => sum + region.placeCount, 0)
    ).toBe(255 + 93);
  });

  it('uses the live count for the region currently on screen', async () => {
    const places = await getRegionPlaces('hongcheon');
    const summary = listRegions({ id: 'hongcheon', count: places.length }).find(
      (region) => region.id === 'hongcheon'
    )!;
    expect(summary.placeCount).toBe(places.length);
  });
});

describe('place ids point back at their region', () => {
  it('reads a place id back to its own region', async () => {
    const [first] = await getRegionPlaces('hongcheon');
    expect(regionOfPlaceId(first.id)).toBe('hongcheon');
    expect(regionOfPlaceId('gw-120')).toBe('gangneung');
    expect(regionOfPlaceId('gw-h-3')).toBe('gangneung');
    expect(regionOfPlaceId('region-seoul-abc')).toBeNull();
    expect(regionOfPlaceId('../gangneung')).toBeNull();
  });

  it('is listed the way the map reads, north to south', () => {
    const groups = groupedRegions(regionCatalog);
    expect(groups.map((group) => group.province)).toEqual(['강원']);
    expect(groups[0].regions.map((region) => region.city)).toEqual([
      '양양군',
      '춘천시',
      '강릉시',
      '홍천군',
      '평창군'
    ]);
    // 강원 전체 보기는 지역이 아니라 모아 보기라 어느 시도 묶음에도 들어가지 않습니다.
    expect(groups.flatMap((group) => group.regions).map((region) => region.id)).not.toContain(
      'all'
    );
  });

  it('keeps that order a real north-to-south order, not a hand-typed one', () => {
    const groups = groupedRegions(regionCatalog);
    // 시도끼리는 그 시도에서 가장 북쪽인 지역을 기준으로 견줍니다.
    const tops = groups.map((group) => Math.max(...group.regions.map((r) => r.center.lat)));
    expect(tops).toEqual([...tops].sort((a, b) => b - a));
    // 한 시도 안에서는 지역끼리 북 → 남.
    for (const group of groups) {
      const lats = group.regions.map((region) => region.center.lat);
      expect(lats).toEqual([...lats].sort((a, b) => b - a));
    }
    // 시도가 목록에서 흩어져 있으면 묶음이 두 번 생겨 위 검사를 통과하지 못합니다.
    expect(new Set(groups.map((group) => group.province)).size).toBe(groups.length);
  });
});

describe('favourites keep working across regions', () => {
  it('finds saved places from several regions at once, newest first', async () => {
    const [chuncheon] = await getRegionPlaces('chuncheon');
    const [pyeongchang] = await getRegionPlaces('pyeongchang');
    const found = await findPlacesByIds([pyeongchang.id, 'gw-120', chuncheon.id, 'unknown-id']);
    expect(found.map((place) => place.id)).toEqual([pyeongchang.id, 'gw-120', chuncheon.id]);
  });
});

describe('the live Gangneung region is untouched', () => {
  it('still comes from its own snapshot', async () => {
    const places = await getRegionPlaces('gangneung');
    expect(places).toHaveLength(93);
    expect(places.every((place) => place.address.includes('강릉'))).toBe(true);
    expect(places.some((place) => place.category === 'hospital')).toBe(true);
  });
});

describe('the whole-province view', () => {
  it('is what you get when no region is picked', () => {
    expect(DEFAULT_REGION_ID).toBe('all');
  });

  it('joins every region exactly once, in the same north-to-south order', async () => {
    const places = await getRegionPlaces('all');
    expect(places).toHaveLength(255 + 93);
    expect(new Set(places.map((place) => place.id)).size).toBe(places.length);
    // 강원 밖 저장본은 파일로만 남아 있고, 화면에는 한 건도 올라오지 않습니다.
    expect(places.every((place) => place.address.startsWith('강원'))).toBe(true);
    // 목록도 지역 선택과 같은 차례로 이어 붙습니다. 양양이 맨 앞, 평창이 맨 뒤예요.
    expect(places[0].address).toContain('양양');
    expect(places.at(-1)!.address).toContain('평창');
    const firstIndex = (city: string) => places.findIndex((place) => place.address.includes(city));
    const order = dataRegions().map((region) => firstIndex(region.city));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('keeps picking up a fresh Gangneung list instead of a frozen copy', async () => {
    const first = await getRegionPlaces('all');
    const second = await getRegionPlaces('all');
    expect(first).not.toBe(second);
    expect(first.map((place) => place.id)).toEqual(second.map((place) => place.id));
  });

  it('has no places of its own to look up by id', () => {
    expect(regionOfPlaceId('region-all-0123456789abcdef0123')).toBeNull();
    expect(dataRegions().map((region) => region.id)).not.toContain('all');
  });
});
