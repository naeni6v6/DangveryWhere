/**
 * 지역 확장 준비 데이터. 현재 getPlaces(), 화면, DB에는 연결하지 않습니다.
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
