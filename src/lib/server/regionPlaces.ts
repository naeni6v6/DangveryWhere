/**
 * 준비 데이터(docs/REGION_DATA_GUIDE.txt)를 화면이 쓰는 Place 로 옮깁니다.
 *
 * 가이드 6절이 요구하는 대로 타입 단언 대신 명시적으로 변환하고, 아래 세 가지를 지킵니다.
 *  - 체중 원문이 비어 있으면 '무제한'이 아니라 '모른다'로 둡니다(sourceWeight = null).
 *  - '미만'과 '이하'를 구분해 sourceWeightBound 에 남깁니다.
 *  - 장소(실내) 여부 / inOutFlag 는 실내 동반 근거로 쓰지 않습니다. 원문에 실외만 허용이라고
 *    적힌 사례가 있어, 규정은 사람이 쓴 문장(policyText)만 옮깁니다.
 * 출처가 둘이면 어느 쪽 문장인지 이름을 붙여 둘 다 남깁니다(상충 보존).
 *
 * 이 저장본은 DB 에 넣지 않습니다. db:setup 은 지금도 강릉 스냅샷만 적재합니다.
 */
import type { FoodKind, Place, WeightBound } from '$lib/domain/place';
import { canonicalPlaceId, canonicalPlaceIds } from '$lib/domain/placeIdentity';
import placeAliases from '$lib/data/placeAliases.json';
import reviewedLinks from '$lib/data/reviewedPlaceLinks.json';
import {
  dataRegions,
  findRegion,
  regionCatalog,
  type RegionId,
  type RegionSummary
} from '$lib/domain/region';
import index from './data/regions/index.json';
import { getPlaces, gangneungSnapshotCount } from './places.repository';
import {
  loadPreparedRegion,
  type PreparedPlaceSource,
  type PreparedRegionalPlace
} from './regions';

/** 강릉 스냅샷과 같은 꼬리말. policyLines() 가 여기서부터 잘라 냅니다. */
const POLICY_FOOTER = '* 반려견 동반 운영 정책은 현지 사정에 따라 변동될 수 있습니다.';

/** 카페로 볼 만한 원본 태그. '맛집'은 카페에도 붙어 있어 넣지 않습니다. */
const CAFE_TAG = /카페|커피|디저트|베이커리|제과|제빵|브런치|빵집|티룸|찻집|로스터리/;

function textOf(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 한 출처의 규정 문장을 줄 단위로 끊습니다.
 * 원본은 '-' 와 '*' 를 섞어 쓰고 줄바꿈이 없기도 해서, 꼬리말을 떼고 두 기호 모두 끊습니다.
 */
export function policyChunks(text: string): string[] {
  return text
    .replace(/\*\s*반려견 동반 운영[\s\S]*$/, '')
    .split(/\s*[-*]\s+|\s*[-*](?=[가-힣])|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 원본이 적어 둔 제한 체중.
 * 비어 있거나 '모두 가능' 같은 문장만 있으면 숫자를 만들어 내지 않고 null 을 돌려줍니다.
 * '10kg, 체고 40cm 이하' 처럼 뒤쪽 '이하'가 체고에 걸린 경우에는 경계를 모르는 것으로 둡니다.
 */
export function parseSourceWeight(
  sizeText: string,
  policyText = ''
): { weight: number; bound?: WeightBound } | null {
  const text = sizeText.trim();
  if (!text) return null;
  const withUnit = /(\d+(?:\.\d+)?)\s*kg\s*(미만|이하)?/i.exec(text);
  const bare = /^(\d+(?:\.\d+)?)$/.exec(text);
  const weight = Number(withUnit?.[1] ?? bare?.[1]);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  const stated = withUnit?.[2];
  if (stated) return { weight, bound: stated === '미만' ? 'under' : 'atMost' };
  // 강원 원본은 숫자만 주므로(petWeight=10), 규정 문장에서 같은 숫자의 경계를 찾아봅니다.
  const inPolicy = new RegExp(`${weight}\\s*kg\\s*(미만|이하)`, 'i').exec(policyText);
  return inPolicy ? { weight, bound: inPolicy[1] === '미만' ? 'under' : 'atMost' } : { weight };
}

/**
 * 원본의 체급 표기를 규정 한 줄로 옮깁니다.
 * profileNotice() 가 읽는 문장 형태로 맞춰, 체급 제한이 우리 강아지 안내에도 반영되게 합니다.
 */
export function sizeClassLine(sizeText: string): string | null {
  const text = sizeText.trim();
  if (!text || /대형/.test(text)) return null;
  if (/중형/.test(text)) return `대형견은 동반하실 수 없습니다 (원본 표기: ${text})`;
  if (/소형/.test(text)) return `소형견만 동반 가능합니다 (원본 표기: ${text})`;
  return null;
}

/**
 * 카페와 식당 가르기. 원본 분류를 그대로 따르고, 판단이 서지 않으면 식당으로 둡니다.
 * (카페가 아닌 곳을 카페라고 부르는 쪽이 더 잘못이라, place.ts 의 기본값과 같은 방향입니다.)
 */
export function foodKindOf(place: PreparedRegionalPlace): FoodKind | null {
  if (place.category !== 'food') return null;
  const tags: string[] = [];
  for (const source of place.sources) {
    if (source.provider === 'kcisa-pet-culture') {
      if (textOf(source.raw, '카테고리3') === '카페') return 'cafe';
      tags.push(textOf(source.raw, '카테고리3'), textOf(source.raw, '카테고리2'));
    } else if (source.provider === 'kto-pet-tour') {
      // 관광공사 분류 코드. A05020900 이 '카페/전통찻집' 한 칸이라 그대로 믿습니다.
      if (textOf(source.raw, 'cat3') === 'A05020900') return 'cafe';
      tags.push(textOf(source.raw, 'cat3'));
    } else {
      tags.push(textOf(source.raw, 'keyword'));
    }
  }
  const joined = tags.join(' ');
  if (/식당/.test(joined)) return 'restaurant';
  return CAFE_TAG.test(joined) ? 'cafe' : 'restaurant';
}

/** 출처마다 소개글이 들어 있는 칸 이름이 다릅니다. */
const descriptionKeys: Record<PreparedPlaceSource['provider'], string> = {
  'gangwon-pettravel': 'content',
  'kto-pet-tour': 'overview',
  'kcisa-pet-culture': '기본 정보_장소설명'
};

/**
 * 소개 문구. 강원 원본과 관광공사 원본의 소개글이 훨씬 길어서 있으면 그쪽을 먼저 씁니다.
 * (문화정보원 쪽은 '애견카페' 한 단어인 경우가 많아요.)
 */
function descriptionOf(place: PreparedRegionalPlace): string {
  const priority: PreparedPlaceSource['provider'][] = [
    'gangwon-pettravel',
    'kto-pet-tour',
    'kcisa-pet-culture'
  ];
  const ordered = [...place.sources].sort(
    (a, b) => priority.indexOf(a.provider) - priority.indexOf(b.provider)
  );
  for (const source of ordered) {
    const text = textOf(source.raw, descriptionKeys[source.provider]);
    if (text) return text;
  }
  return '';
}

/**
 * 대표 메뉴. 강원 원본의 '이용요금'(usedCost) 칸을 그대로 옮깁니다.
 * 이 칸은 숙소면 객실 요금, 관광지면 입장료가 들어오므로 식당·카페에서만 읽습니다.
 * 문화정보원 출처만 있는 장소에는 칸 자체가 없어 빈 문자열이 됩니다.
 */
export function menuOf(place: PreparedRegionalPlace): string {
  if (place.category !== 'food') return '';
  for (const source of place.sources) {
    if (source.provider !== 'gangwon-pettravel') continue;
    const text = textOf(source.raw, 'usedCost');
    if (text) return text;
  }
  // 관광공사 원본은 대표메뉴·취급메뉴를 상세 칸에 따로 둡니다. 강원 원본이 없을 때만 씁니다.
  for (const source of place.sources) {
    if (source.provider !== 'kto-pet-tour') continue;
    const intro = source.raw.intro;
    if (!intro || typeof intro !== 'object') continue;
    const detail = intro as Record<string, unknown>;
    const text = [textOf(detail, 'firstmenu'), textOf(detail, 'treatmenu')]
      .filter(Boolean)
      .join(' / ');
    if (text) return text;
  }
  return '';
}

function policyOf(place: PreparedRegionalPlace): string {
  const lines: string[] = [];
  for (const source of place.sources) {
    // 예전에는 출처가 둘이면 문장마다 '[한국관광공사] ' 처럼 이름표를 달았습니다. 그런데 같은
    // 규정이 자료마다 조금씩 다르게 적혀 있을 뿐인데 이름표 때문에 서로 다른 줄로 남아,
    // 읽는 사람 앞에는 같은 말이 두 번씩 놓였어요. 어느 자료에서 왔는지는 아래 '자료 출처'
    // 칸이 이미 말해 주므로, 규정 줄에서는 빼고 문장만 남깁니다.
    for (const chunk of policyChunks(source.policyText)) lines.push(`- ${chunk}`);
    const sizeLine = sizeClassLine(source.sizeText);
    if (sizeLine) lines.push(`- ${sizeLine}`);
  }
  if (!lines.length) lines.push('- 원본에 동반 규정 문장이 없어요. 방문 전 전화로 확인해 주세요.');
  return [...new Set(lines)].join('\n') + '\n' + POLICY_FOOTER;
}

function weightOf(place: PreparedRegionalPlace): {
  sourceWeight: number | null;
  sourceWeightBound?: WeightBound;
} {
  let strictest: { weight: number; bound?: WeightBound } | null = null;
  for (const source of place.sources) {
    const parsed = parseSourceWeight(source.sizeText, source.policyText);
    // 출처마다 다르게 적혀 있으면 낮은 쪽을 씁니다. 규정을 느슨하게 보여 주지 않으려고요.
    if (parsed && (!strictest || parsed.weight < strictest.weight)) strictest = parsed;
  }
  if (!strictest) return { sourceWeight: null };
  return strictest.bound
    ? { sourceWeight: strictest.weight, sourceWeightBound: strictest.bound }
    : { sourceWeight: strictest.weight };
}

/** 준비 데이터 한 건 → 화면이 쓰는 Place 한 건. */
export function toPlace(place: PreparedRegionalPlace, collectedAt: string): Place {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    foodKind: foodKindOf(place),
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    phone: place.phone,
    description: descriptionOf(place),
    policy: policyOf(place),
    hours: place.hours,
    menu: menuOf(place),
    sourceUrl: place.sources[0].url,
    // 수집일입니다. 업체에 규정을 확인한 날이 아니에요.
    importedAt: collectedAt,
    verifiedAt: null,
    ...weightOf(place),
    // Contact/location review is independent of pet-policy verification.
    ...(reviewedLinks as Record<string, { corrections?: Partial<Place> }>)[place.id]?.corrections
  };
}

/** 한 번 옮긴 지역은 그대로 다시 씁니다. 돌려받은 목록은 읽기 전용으로만 쓰세요. */
const converted = new Map<RegionId, Place[]>();

/** 저장본이 있는 지역들. 강원 전체 보기는 이들을 지도 순서(북 → 남)대로 이어 붙여 만듭니다. */
const dataRegionIds = dataRegions().map((region) => region.id);

/** Confirmed same business: retain both source records, expose one canonical place. */
function mergeReviewedDuplicates(places: PreparedRegionalPlace[]): PreparedRegionalPlace[] {
  const groups = new Map<string, PreparedRegionalPlace[]>();
  for (const place of places) {
    const id = canonicalPlaceId(place.id);
    groups.set(id, [...(groups.get(id) ?? []), place]);
  }
  return [...groups].map(([id, group]) => {
    const canonical = group.find((place) => place.id === id) ?? group[0];
    return {
      ...canonical,
      id,
      phone: canonical.phone || group.find((place) => place.phone)?.phone || '',
      hours: canonical.hours || group.find((place) => place.hours)?.hours || '',
      sources: group.flatMap((place) => place.sources)
    };
  });
}

export async function getRegionPlaces(regionId: RegionId): Promise<Place[]> {
  // 강릉은 DB 가 원본이라 캐시하지 않습니다. DB 를 고치면 바로 반영돼야 하니까요.
  if (regionId === 'gangneung') return getPlaces();
  if (regionId === 'all') {
    const byRegion = await Promise.all(dataRegionIds.map((id) => getRegionPlaces(id)));
    return byRegion.flat();
  }
  const cached = converted.get(regionId);
  if (cached) return cached;
  const dataset = await loadPreparedRegion(regionId);
  const places = mergeReviewedDuplicates(dataset.places).map((place) => {
    const converted = toPlace(place, dataset.collectedAt);
    if (place.id === 'region-yangyang-4a80633bd5595369f7bb') {
      converted.policy =
        '자료마다 제한 체중이 달라 더 엄격한 10kg 미만 기준으로 표시합니다. 한국문화정보원은 10kg 미만, 강원 반려동반관광은 13kg으로 기재했습니다. 현재 기준은 업체에 확인해 주세요.\n' +
        // Preserve the raw records, but do not display an unqualified "no restrictions" next to a limit.
        converted.policy.replace(/^- 제한사항 없음\r?\n/gm, '');
    }
    return converted;
  });
  converted.set(regionId, places);
  return places;
}

/** 장소 id 하나가 어느 지역 것인지. 찜 목록처럼 id 만 들고 있을 때 씁니다. */
export function regionOfPlaceId(placeId: string): RegionId | null {
  for (const region of regionCatalog) {
    if (region.status === 'prepared' && placeId.startsWith(`region-${region.id}-`))
      return region.id;
  }
  return /^gw-(h-)?\d+$/.test(placeId) ? 'gangneung' : null;
}

/**
 * 찜한 장소는 지금 보고 있는 지역 밖에 있을 수 있습니다.
 * id 로 지역을 먼저 좁혀, 필요한 지역만 읽습니다.
 */
export async function findPlacesByIds(placeIds: string[]): Promise<Place[]> {
  placeIds = canonicalPlaceIds(placeIds);
  const byRegion = new Map<RegionId, Set<string>>();
  for (const placeId of placeIds) {
    const regionId = regionOfPlaceId(placeId);
    if (!regionId) continue;
    const bucket = byRegion.get(regionId) ?? new Set<string>();
    bucket.add(placeId);
    byRegion.set(regionId, bucket);
  }
  const found = new Map<string, Place>();
  for (const [regionId, ids] of byRegion) {
    for (const place of await getRegionPlaces(regionId)) {
      if (ids.has(place.id)) found.set(place.id, place);
    }
  }
  // 찜한 순서(최근 순)를 그대로 지킵니다.
  return placeIds.map((id) => found.get(id)).filter((place): place is Place => Boolean(place));
}

/**
 * 아직 불러오지 않은 지역에 보여 줄 대략의 개수.
 * index.json 은 수집 당시의 여덟 지역을 그대로 담고 있어서(강원 밖도 포함), 합계를 그대로 쓰지 않고
 * 지금 목록에 있는 지역만 더합니다.
 */
function fallbackCount(regionId: RegionId): number {
  if (regionId === 'gangneung') return gangneungSnapshotCount;
  // dataRegionIds 에는 강릉도 들어 있어, 여기서 한 번만 더해집니다.
  if (regionId === 'all') return dataRegionIds.reduce((sum, id) => sum + fallbackCount(id), 0);
  const merged = Object.keys(placeAliases).filter((id) => regionOfPlaceId(id) === regionId).length;
  return (index.regions[regionId as keyof typeof index.regions]?.candidateCount ?? 0) - merged;
}

/**
 * 지역 선택에 보여 줄 목록.
 * 장소 수는 지금 불러온 지역만 실제 값이고, 나머지는 준비 데이터의 후보 수입니다.
 */
export function listRegions(actual?: { id: RegionId; count: number }): RegionSummary[] {
  return regionCatalog.map((region) => ({
    ...region,
    placeCount: actual && actual.id === region.id ? actual.count : fallbackCount(region.id)
  }));
}

export { findRegion };
