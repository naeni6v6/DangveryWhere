// 관광공사 반려동물 동반여행 저장본을 강원 지역 데이터에 합칩니다.
// Usage: node scripts/merge-kto-pet-tour.mjs        (미리보기)
//        node scripts/merge-kto-pet-tour.mjs --write (실제 저장)
//
// 먼저 scripts/fetch-kto-pet-tour.mjs 로 저장본을 받아 두어야 합니다.
//
// 하는 일
//  1. 이미 있는 장소와 같은 곳이면 sources[] 에 '한국관광공사' 출처를 덧붙입니다(원문 보존).
//  2. 우리 목록에 없던 곳은 새 후보로 추가합니다.
//  3. 사진 주소를 src/lib/data/placeImages.json 에 적습니다.
//
// 매칭 규칙
//  - 이름이 같고 5km 안이면 같은 곳으로 봅니다(원본마다 좌표 정밀도가 달라서 넉넉히 둡니다).
//  - 이름이 한쪽에 포함되는 정도면 150m 안일 때만 같은 곳으로 봅니다.
//  - 한 KTO 레코드는 한 장소에만 붙습니다. 지점이 여러 개인 체인이 한 곳으로 뭉치지 않게요.
//
// 사진을 내려받지 않는 이유
//  - 강원 394건 중 282건이 공공누리 제3유형(출처표시 + 변경금지)입니다. pettravel 사진처럼
//    webp 로 줄이면 변경금지에 걸려, tong.visitkorea.or.kr 원본 주소를 그대로 씁니다.
//    이 호스트는 https 가 정상이라 배포 환경에서도 그대로 열립니다.
import { readFile, writeFile } from 'node:fs/promises';

const write = process.argv.includes('--write');
const root = new URL('../', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const snapshot = await read('src/lib/server/data/kto-pet-tour.json');
const records = Object.values(snapshot.records);
const collectedAt = snapshot.collectedAt;
const SOURCE_URL = snapshot.url;

/** 우리 지역 id ↔ 주소에 적힌 시군 이름. 이 목록에 없는 시군은 서비스 지역이 아니라 건너뜁니다. */
const regionCities = {
  gangneung: '강릉시',
  chuncheon: '춘천시',
  yangyang: '양양군',
  pyeongchang: '평창군',
  hongcheon: '홍천군'
};
/** 관광공사 콘텐츠 분류 → 우리 분류. */
const categories = {
  12: 'outdoor',
  14: 'culture',
  28: 'activity',
  32: 'stay',
  38: 'shopping',
  39: 'food'
};
/** 분류마다 이름이 다른 상세 칸들. (관광지만 접미사가 없습니다) */
const introKeys = {
  12: { hours: 'usetime', rest: 'restdate', tel: 'infocenter' },
  14: { hours: 'usetimeculture', rest: 'restdateculture', tel: 'infocenterculture' },
  28: { hours: 'usetimeleports', rest: 'restdateleports', tel: 'infocenterleports' },
  32: { hours: 'checkintime', rest: '', tel: 'infocenterlodging' },
  38: { hours: 'opentime', rest: 'restdateshopping', tel: 'infocentershopping' },
  39: { hours: 'opentimefood', rest: 'restdatefood', tel: 'infocenterfood' }
};

const clean = (value) =>
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const cityOf = (address) => (/강원(?:특별자치)?도\s+(\S+)/.exec(String(address ?? '')) ?? [])[1] ?? '';

/** 이름 비교용. 괄호 안 설명과 띄어쓰기·기호를 떼고 견줍니다. */
const norm = (value) =>
  String(value ?? '')
    .replace(/\(.*?\)/g, '')
    .replace(/[\s\-_,.·'"]/g, '')
    .toLowerCase();

function metres(lat1, lon1, lat2, lon2) {
  const radius = 6371000;
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

/**
 * 동반 규정 문장. detailPetTour2 의 칸들을 사람이 읽는 순서로 잇습니다.
 * policyChunks() 가 줄바꿈으로 끊으므로 한 줄에 하나씩 둡니다.
 * 빈 칸은 그냥 뺍니다. '제한 없음'으로 바꿔 적지 않아요.
 */
function policyTextOf(pet) {
  if (!pet) return '';
  const lines = [];
  const type = clean(pet.acmpyTypeCd);
  if (type) lines.push(type.includes('전구역') ? '전 구역에 동반하실 수 있습니다' : type);
  for (const key of ['acmpyPsblCpam', 'acmpyNeedMtr', 'relaAcdntRiskMtr', 'etcAcmpyInfo']) {
    const text = clean(pet[key]);
    // 한 칸 안에 '- 이것- 저것' 처럼 여러 문장을 몰아 적어 둔 경우가 많습니다.
    // 화면이 규정을 쪼개는 기준(place.ts 의 policyLines, regionPlaces.ts 의 policyChunks)과
    // 같은 구분자로 미리 끊어 둡니다. 전화번호(033-339-0000)는 토막 나면 안 되니
    // 글머리표 뒤에 공백이 있거나 한글이 바로 붙은 경우만 끊어요.
    for (const part of text.split(/\s*[-*]\s+|\s*[-*](?=[가-힣])/)) {
      const line = part.trim();
      if (line) lines.push(line);
    }
  }
  const facility = clean(pet.relaPosesFclty);
  if (facility) lines.push(`반려동물 시설: ${facility}`);
  for (const [key, label] of [
    ['relaFrnshPrdlst', '제공 용품'],
    ['relaRntlPrdlst', '대여 용품'],
    ['relaPurcPrdlst', '구매 가능 용품']
  ]) {
    const text = clean(pet[key]);
    if (text) lines.push(`${label}: ${text}`);
  }
  // 원본이 같은 문장을 두 칸에 나눠 적어 둔 곳이 있습니다(체중 칸과 기타 안내 칸에
  // '전 견종 동반 가능'이 똑같이 들어오는 식). 같은 줄은 한 번만 남깁니다.
  return [...new Set(lines)].join('\n');
}

function hoursOf(record) {
  const keys = introKeys[record.contenttypeid];
  if (!record.intro || !keys) return '';
  const hours = clean(record.intro[keys.hours]);
  const rest = keys.rest ? clean(record.intro[keys.rest]) : '';
  if (record.contenttypeid === '32') {
    const out = clean(record.intro.checkouttime);
    return [hours && `입실 ${hours}`, out && `퇴실 ${out}`].filter(Boolean).join(' / ');
  }
  return [hours, rest && `휴무 ${rest}`].filter(Boolean).join(' / ');
}

function phoneOf(record) {
  const keys = introKeys[record.contenttypeid];
  const fromList = clean(record.list.tel);
  const fromIntro = keys && record.intro ? clean(record.intro[keys.tel]) : '';
  // 전화번호만 남깁니다. 원본은 '033-123-4567(예약)' 처럼 설명을 붙여 두기도 해요.
  const picked = fromList || fromIntro;
  return (/\d[\d\-() ]{6,}\d/.exec(picked) ?? [picked])[0].trim();
}

/** 대표 메뉴. 음식점 상세의 대표메뉴·취급메뉴 칸입니다. */
function menuOf(record) {
  if (record.contenttypeid !== '39' || !record.intro) return '';
  const first = clean(record.intro.firstmenu);
  const more = clean(record.intro.treatmenu);
  return [first, more].filter(Boolean).join(' / ');
}

/** 한 KTO 레코드를 sources[] 한 칸으로. raw 에 원문을 통째로 남깁니다. */
function sourceOf(record) {
  return {
    provider: 'kto-pet-tour',
    recordId: `kto-${record.contentid}`,
    url: SOURCE_URL,
    collectedAt,
    // 원본이 적어 둔 최종 수정일입니다(YYYYMMDDHHMMSS → YYYY-MM-DD).
    updatedAt: /^\d{8}/.test(record.list.modifiedtime ?? '')
      ? `${record.list.modifiedtime.slice(0, 4)}-${record.list.modifiedtime.slice(4, 6)}-${record.list.modifiedtime.slice(6, 8)}`
      : null,
    // 관광공사가 관리하는 자료지만, 업체에 직접 확인한 날은 아니라 null 로 둡니다.
    verifiedAt: null,
    policyText: policyTextOf(record.pet),
    sizeText: clean(record.pet?.acmpyPsblCpam),
    raw: {
      ...record.list,
      overview: clean(record.common?.overview),
      homepage: clean(record.common?.homepage),
      intro: record.intro ?? null,
      pet: record.pet ?? null,
      photos: record.photos,
      cpyrhtDivCd: record.copyright
    }
  };
}

// ── 우리 데이터 읽기 ────────────────────────────────────────────────────────
const gangneung = await read('src/lib/server/data/gangneung.json');
const regionFiles = {};
for (const regionId of ['chuncheon', 'yangyang', 'pyeongchang', 'hongcheon']) {
  regionFiles[regionId] = await read(`src/lib/server/data/regions/${regionId}.json`);
}
const placeImages = await read('src/lib/data/placeImages.json');

/** 매칭 대상을 한 배열로 모읍니다. 강릉은 Place, 나머지는 준비 데이터 후보입니다. */
const targets = [
  ...gangneung.map((place) => ({ place, regionId: 'gangneung', kind: 'place' })),
  ...Object.entries(regionFiles).flatMap(([regionId, dataset]) =>
    dataset.places.map((place) => ({ place, regionId, kind: 'prepared' }))
  )
];

// ── 매칭 ───────────────────────────────────────────────────────────────────
const taken = new Set();
const matches = [];
for (const target of targets) {
  const { place } = target;
  const name = norm(place.name);
  const near = (record, limit) =>
    metres(place.latitude, place.longitude, Number(record.list.mapy), Number(record.list.mapx)) <
    limit;
  let hit = records.find(
    (record) => !taken.has(record.contentid) && norm(record.list.title) === name && near(record, 5000)
  );
  if (!hit) {
    hit = records.find(
      (record) =>
        !taken.has(record.contentid) &&
        near(record, 150) &&
        (norm(record.list.title).includes(name) || name.includes(norm(record.list.title)))
    );
  }
  if (hit) {
    taken.add(hit.contentid);
    matches.push({ ...target, record: hit });
  }
}

// ── 1. 이미 있는 장소에 출처 덧붙이기 ──────────────────────────────────────
let attached = 0;
for (const match of matches) {
  if (match.kind !== 'prepared') continue;
  const already = match.place.sources.some((source) => source.provider === 'kto-pet-tour');
  if (already) continue;
  match.place.sources.push(sourceOf(match.record));
  attached += 1;
}

/**
 * 강릉은 DB 가 원본이라 sources[] 가 없습니다. 규정 문장에 출처를 밝혀 덧붙입니다.
 * 이미 같은 문장이 들어 있으면 두 번 적지 않습니다.
 */
const FOOTER = '* 반려견 동반 운영 정책은 현지 사정에 따라 변동될 수 있습니다.';
let policyUpdated = 0;
for (const match of matches) {
  if (match.kind !== 'place') continue;
  // gw-k- 는 이 스크립트가 관광공사 원본으로 만든 장소입니다. 규정이 이미 그 원본에서
  // 왔으므로, 다시 돌릴 때 자기 원본과 매칭돼 같은 문장이 한 번 더 붙지 않게 건너뜁니다.
  if (match.place.id.startsWith('gw-k-')) continue;
  const lines = policyTextOf(match.record.pet)
    .split('\n')
    .filter(Boolean)
    .map((line) => `- [한국관광공사] ${line}`);
  if (!lines.length) continue;
  const current = match.place.policy ?? '';
  const fresh = lines.filter((line) => !current.includes(line));
  if (!fresh.length) continue;
  const body = current.replace(/\n?\*\s*반려견 동반 운영[\s\S]*$/, '').trimEnd();
  match.place.policy = [body, ...fresh].filter(Boolean).join('\n') + '\n' + FOOTER;
  policyUpdated += 1;
}

// ── 2. 새 장소 추가 ────────────────────────────────────────────────────────
const cityToRegion = Object.fromEntries(
  Object.entries(regionCities).map(([regionId, city]) => [city, regionId])
);
const added = { gangneung: 0, chuncheon: 0, yangyang: 0, pyeongchang: 0, hongcheon: 0 };
const skipped = { region: 0, category: 0 };
const newPlaceIds = new Map();

/** 이미 들어와 있는 id. 이 스크립트를 두 번 돌려도 같은 장소가 또 생기지 않게 합니다. */
const existingIds = new Set([
  ...gangneung.map((place) => place.id),
  ...Object.values(regionFiles).flatMap((dataset) => dataset.places.map((place) => place.id))
]);

for (const record of records) {
  if (taken.has(record.contentid)) continue;
  const regionId = cityToRegion[cityOf(record.list.addr1)];
  if (!regionId) {
    skipped.region += 1;
    continue;
  }
  const category = categories[record.contenttypeid];
  if (!category) {
    skipped.category += 1;
    continue;
  }
  const latitude = Number(record.list.mapy);
  const longitude = Number(record.list.mapx);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    skipped.category += 1;
    continue;
  }
  const id =
    regionId === 'gangneung'
      ? `gw-k-${record.contentid}`
      : `region-${regionId}-kto-${record.contentid}`;
  // 같은 스크립트를 다시 돌려도 이미 들어온 장소는 건드리지 않습니다.
  if (existingIds.has(id)) {
    newPlaceIds.set(record.contentid, id);
    continue;
  }
  const name = clean(record.list.title);
  const address = clean(record.list.addr1);
  const source = sourceOf(record);

  if (regionId === 'gangneung') {
    // 강릉은 DB 스냅샷(Place)이라 모양이 다릅니다. gw-k- 접두사는 db/007 이 허용합니다.
    const policy = policyTextOf(record.pet)
      .split('\n')
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join('\n');
    gangneung.push({
      id,
      name,
      category,
      foodKind:
        category === 'food' ? (record.list.cat3 === 'A05020900' ? 'cafe' : 'restaurant') : null,
      address,
      latitude,
      longitude,
      phone: phoneOf(record),
      description: clean(record.common?.overview),
      policy:
        (policy || '- 원본에 동반 규정 문장이 없어요. 방문 전 전화로 확인해 주세요.') +
        '\n' +
        FOOTER,
      hours: hoursOf(record),
      menu: menuOf(record),
      sourceUrl: SOURCE_URL,
      importedAt: collectedAt,
      verifiedAt: null,
      sourceWeight: null
    });
    newPlaceIds.set(record.contentid, id);
    added.gangneung += 1;
  } else {
    regionFiles[regionId].places.push({
      id,
      regionId,
      name,
      category,
      address,
      latitude,
      longitude,
      phone: phoneOf(record),
      hours: hoursOf(record),
      reviewStatus: 'unverified',
      sources: [source]
    });
    newPlaceIds.set(record.contentid, id);
    added[regionId] += 1;
  }
}

// ── 3. 사진 ────────────────────────────────────────────────────────────────
let photoNew = 0;
let photoExtra = 0;
for (const match of matches) {
  if (!match.record.photos.length) continue;
  const id = match.place.id;
  const current = placeImages[id] ?? [];
  // 우리가 이미 받아 둔 pettravel 사진이 앞에 오게 두고, 관광공사 사진을 뒤에 잇습니다.
  const merged = [...current];
  for (const url of match.record.photos) if (!merged.includes(url)) merged.push(url);
  if (merged.length === current.length) continue;
  if (!current.length) photoNew += 1;
  else photoExtra += 1;
  placeImages[id] = merged;
}
for (const record of records) {
  const id = newPlaceIds.get(record.contentid);
  if (!id || !record.photos.length) continue;
  placeImages[id] = record.photos;
  photoNew += 1;
}

// ── 4. 저장 ────────────────────────────────────────────────────────────────
console.log(`관광공사 저장본 ${records.length}건 (수집 ${collectedAt})`);
console.log(`같은 곳으로 본 장소 ${matches.length}건`);
console.log(`  준비 데이터에 출처 추가 ${attached}건 / 강릉 규정에 문장 추가 ${policyUpdated}건`);
console.log('새로 추가한 장소:', added);
console.log(`  서비스 지역 밖이라 건너뜀 ${skipped.region}건, 분류를 못 정해 건너뜀 ${skipped.category}건`);
console.log(`사진: 없던 곳 ${photoNew}곳에 새로, 있던 곳 ${photoExtra}곳에 덧붙임`);

if (!write) {
  console.log('\n미리보기였습니다. 실제로 저장하려면 --write 를 붙여 주세요.');
  process.exit(0);
}

const save = (path, value) =>
  writeFile(new URL(path, root), JSON.stringify(value, null, ' ').replace(/\r\n/g, '\n') + '\n');

await save('src/lib/server/data/gangneung.json', gangneung);
for (const [regionId, dataset] of Object.entries(regionFiles)) {
  dataset.collectedAt = collectedAt;
  await save(`src/lib/server/data/regions/${regionId}.json`, dataset);
}
await save('src/lib/data/placeImages.json', placeImages);

// index.json 의 제공처 상태와 지역별 후보 수를 실제 값으로 맞춥니다.
const index = await read('src/lib/server/data/regions/index.json');
index.providers['kto-pet-tour'] = {
  status: 'api-collected',
  url: SOURCE_URL,
  collectedAt,
  records: records.length,
  attribution: snapshot.attribution
};
for (const [regionId, dataset] of Object.entries(regionFiles)) {
  if (index.regions[regionId]) index.regions[regionId].candidateCount = dataset.places.length;
}
index.totalCandidates = Object.values(index.regions).reduce(
  (sum, region) => sum + region.candidateCount,
  0
);
await save('src/lib/server/data/regions/index.json', index);

console.log('\n저장했습니다. 강릉은 DB 원본이라 `npm run db:setup` 을 한 번 더 돌려 주세요.');
