/**
 * 지역 확장 준비 데이터의 원본 저장본을 읽습니다. 출처별 원문(sources[].raw)이 그대로 들어 있어요.
 * 화면이 쓰는 Place 로 옮기는 일은 regionPlaces.ts 가 하고, 이 파일은 저장본만 돌려줍니다.
 * DB 에는 넣지 않습니다. db:setup 은 지금도 강릉 스냅샷만 적재해요.
 * 인수인계 및 사용법: docs/REGION_DATA_GUIDE.txt
 */
import index from './data/regions/index.json';

export type PreparedRegionId = keyof typeof index.regions;
export type PreparedRegion = (typeof index.regions)[PreparedRegionId];

export type PreparedPlaceSource = {
  provider: 'gangwon-pettravel' | 'kcisa-pet-culture';
  recordId: string;
  url: string;
  collectedAt: string;
  updatedAt: string | null;
  verifiedAt: null;
  policyText: string;
  sizeText: string;
  raw: Record<string, unknown>;
};

// Deliberately distinct from the active Place model: source conflicts, culture
// categories, and entry conditions must be reviewed before enabling a region.
export type PreparedRegionalPlace = {
  id: string;
  regionId: PreparedRegionId;
  name: string;
  category: 'food' | 'stay' | 'outdoor' | 'activity' | 'culture';
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  hours: string;
  reviewStatus: 'unverified';
  sources: PreparedPlaceSource[];
};

export type PreparedRegionDataset = {
  schemaVersion: 1;
  status: 'prepared';
  collectedAt: string;
  region: PreparedRegion;
  places: PreparedRegionalPlace[];
};

const loaders = {
  chuncheon: () => import('./data/regions/chuncheon.json'),
  yangyang: () => import('./data/regions/yangyang.json'),
  seogwipo: () => import('./data/regions/seogwipo.json'),
  pyeongchang: () => import('./data/regions/pyeongchang.json'),
  'jeju-si': () => import('./data/regions/jeju-si.json'),
  taean: () => import('./data/regions/taean.json'),
  hongcheon: () => import('./data/regions/hongcheon.json'),
  gapyeong: () => import('./data/regions/gapyeong.json')
} satisfies Record<PreparedRegionId, () => Promise<{ default: unknown }>>;

export function listPreparedRegions(): PreparedRegion[] {
  return structuredClone(Object.values(index.regions)).sort((a, b) => a.rank - b.rank);
}

export function isPreparedRegionId(value: string): value is PreparedRegionId {
  return Object.hasOwn(index.regions, value);
}

/** Server-only, explicit opt-in; loads one saved snapshot with no API/DB request. */
export async function loadPreparedRegion(regionId: string): Promise<PreparedRegionDataset> {
  if (!isPreparedRegionId(regionId)) {
    throw new Error(`Unknown prepared region: ${regionId}`);
  }
  const { default: dataset } = await loaders[regionId]();
  // Each consumer gets an independent copy; editing a draft cannot poison the cache.
  return structuredClone(dataset) as PreparedRegionDataset;
}
