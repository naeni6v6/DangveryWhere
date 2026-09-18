/**
 * 화면이 지금 보고 있는 지역.
 *
 * 다루는 곳을 강원도로 좁혔습니다. 공공데이터가 강원에 가장 두껍게 쌓여 있어, 넓게 얕게
 * 펼치기보다 한 도를 제대로 담는 쪽을 골랐어요. 제주·태안·가평 저장본은 지우지 않고
 * src/lib/server/data/regions 에 그대로 두었으니, 다시 열려면 아래 목록에 되돌리면 됩니다.
 *
 * 강릉만 DB·스냅샷으로 서비스 중인 지역이고, 나머지 네 곳은 아직 현장 확인을 하지 않은
 * 준비 데이터입니다(docs/REGION_DATA_GUIDE.txt). 둘을 한 목록에 두되 status 로 구분해,
 * 화면에서 '준비 데이터'임을 감추지 않습니다.
 *
 * center·zoom 은 각 지역 데이터의 좌표 범위에서 뽑아 적어 둔 값입니다. 지도를 띄울 때마다
 * 348건을 다시 읽지 않으려고 여기에 적어 두었고, 데이터가 바뀌어 값이 어긋나면
 * src/lib/server/regionPlaces.test.ts 가 잡아 줍니다.
 */
export type RegionId =
  // 강원을 한꺼번에 보는 가상 지역. 저장본이 따로 없고 나머지를 합쳐 만듭니다.
  | 'all'
  | 'gangneung'
  | 'chuncheon'
  | 'yangyang'
  | 'pyeongchang'
  | 'hongcheon';

/** 지금 저장본에 들어 있는 원본 제공처. 지역마다 섞여 있어 화면에 출처를 그대로 밝힙니다. */
export type ProviderId = 'gangwon-pettravel' | 'kcisa-pet-culture';

export const providerInfo: Record<ProviderId, { name: string; shortName: string; url: string }> = {
  'gangwon-pettravel': {
    name: '강원 반려동물 동반관광',
    shortName: '강원 반려동반관광',
    url: 'https://www.pettravel.kr/petapi/data/total'
  },
  'kcisa-pet-culture': {
    name: '한국문화정보원 반려동물 동반 가능 문화시설',
    shortName: '한국문화정보원',
    url: 'https://www.data.go.kr/data/15111389/fileData.do'
  }
};

export type RegionGeo = {
  id: RegionId;
  province: string;
  city: string;
  /** 지도·목록 문구에 그대로 쓰는 이름 ('강원 강릉시') */
  label: string;
  center: { lat: number; lng: number };
  zoom: number;
  /** 이 지역 데이터가 어디서 왔는지. regionPlaces.test.ts 가 저장본과 대조합니다. */
  sources: ProviderId[];
  /**
   * active  : 현장 반영 데이터로 서비스 중 (강릉)
   * prepared: 공공데이터 저장본만 있고 업체 확인 전 (나머지 네 곳)
   * mixed   : 위 둘을 합쳐 보는 강원 전체 보기
   */
  status: 'active' | 'prepared' | 'mixed';
};

/** 지역 하나와 그 지역에 담긴 장소 수. 서버가 채워서 화면으로 내려 줍니다. */
export type RegionSummary = RegionGeo & { placeCount: number };

/** 지역을 고르지 않았을 때 보여 줄 기본값. 강원 전체를 먼저 보여 주고 좁혀 가게 합니다. */
export const DEFAULT_REGION_ID: RegionId = 'all';

/**
 * 지도에서 보이는 차례대로, 북 → 남 순으로 적어 둡니다.
 * (regionPlaces.test.ts 가 순서가 어긋나면 잡아 줍니다.)
 * 강원 전체는 지역이 아니라 모아 보기라 맨 앞에 따로 둡니다.
 */
export const regionCatalog: RegionGeo[] = [
  {
    id: 'all',
    province: '강원',
    city: '강원 전체',
    label: '강원 전체',
    // 평창 남단부터 고성 경계까지, 강원이 한 화면에 들어오는 중심·확대 단계입니다.
    center: { lat: 37.7519, lng: 128.2819 },
    zoom: 9,
    sources: ['kcisa-pet-culture', 'gangwon-pettravel'],
    status: 'mixed'
  },
  {
    id: 'yangyang',
    province: '강원',
    city: '양양군',
    label: '강원 양양군',
    center: { lat: 38.0386, lng: 128.6469 },
    zoom: 11,
    sources: ['kcisa-pet-culture', 'gangwon-pettravel'],
    status: 'prepared'
  },
  {
    id: 'chuncheon',
    province: '강원',
    city: '춘천시',
    label: '강원 춘천시',
    center: { lat: 37.8345, lng: 127.6706 },
    zoom: 11,
    sources: ['kcisa-pet-culture', 'gangwon-pettravel'],
    status: 'prepared'
  },
  {
    id: 'gangneung',
    province: '강원',
    city: '강릉시',
    label: '강원 강릉시',
    center: { lat: 37.7594, lng: 128.8888 },
    zoom: 11,
    sources: ['gangwon-pettravel'],
    status: 'active'
  },
  {
    id: 'hongcheon',
    province: '강원',
    city: '홍천군',
    label: '강원 홍천군',
    center: { lat: 37.714, lng: 127.9168 },
    zoom: 10,
    sources: ['kcisa-pet-culture', 'gangwon-pettravel'],
    status: 'prepared'
  },
  {
    id: 'pyeongchang',
    province: '강원',
    city: '평창군',
    label: '강원 평창군',
    center: { lat: 37.5294, lng: 128.512 },
    zoom: 11,
    sources: ['kcisa-pet-culture', 'gangwon-pettravel'],
    status: 'prepared'
  }
];

/**
 * 장소 하나의 원문 주소가 어느 제공처인지. Place 에는 sourceUrl 만 있어서 여기서 되짚습니다.
 * 강릉 스냅샷의 pettravel.kr 주소도 같은 규칙으로 걸립니다.
 */
export function providerOfUrl(url: string): ProviderId | null {
  if (url.includes('pettravel.kr')) return 'gangwon-pettravel';
  if (url.includes('data.go.kr/data/15111389')) return 'kcisa-pet-culture';
  return null;
}

export function findRegion(id: string): RegionGeo | null {
  return regionCatalog.find((region) => region.id === id) ?? null;
}

/** 저장본이 실제로 있는 지역만. 모아 보기('all')는 빠집니다. */
export function dataRegions(): RegionGeo[] {
  return regionCatalog.filter((region) => region.status !== 'mixed');
}

/**
 * 시도별로 묶은 지역 목록. 지금은 '강원' 한 묶음이지만, 도를 더 열 때 그대로 쓰려고 남겨 둡니다.
 * regionCatalog 에 적어 둔 차례를 그대로 따르므로 북 → 남 순서가 유지됩니다.
 */
export function groupedRegions<T extends RegionGeo>(
  regions: T[]
): { province: string; regions: T[] }[] {
  const groups: { province: string; regions: T[] }[] = [];
  for (const region of regions) {
    if (region.status === 'mixed') continue;
    const last = groups.at(-1);
    if (last?.province === region.province) last.regions.push(region);
    else groups.push({ province: region.province, regions: [region] });
  }
  return groups;
}

/** 주소창이나 쿠키에서 온 값. 모르는 이름이면 조용히 기본 지역으로 돌립니다. */
export function resolveRegionId(value: string | null | undefined): RegionId {
  return value && findRegion(value) ? (value as RegionId) : DEFAULT_REGION_ID;
}
