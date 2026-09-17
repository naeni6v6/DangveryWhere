// Offline preparation only: never calls APIs, writes to the DB, or enables a region.
// Usage: npm run data:regions:prepare -- <directory containing the research JSONs>
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run data:regions:prepare -- <research-directory>');
  process.exit(1);
}

const definitions = [
  ['chuncheon', '강원', '춘천시'],
  ['yangyang', '강원', '양양군'],
  ['seogwipo', '제주', '서귀포시'],
  ['pyeongchang', '강원', '평창군'],
  ['jeju-si', '제주', '제주시'],
  ['taean', '충남', '태안군'],
  ['hongcheon', '강원', '홍천군'],
  ['gapyeong', '경기', '가평군']
];
const urls = {
  gangwon: 'https://www.pettravel.kr/petapi/api/way',
  culture: 'https://www.data.go.kr/data/15111389/fileData.do'
};
const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, '');
const addressKey = (value) =>
  normalize(
    String(value ?? '').replace(
      /강원특별자치도|강원도|제주특별자치도|충청남도|경기도/g,
      (name) =>
        ({
          강원특별자치도: '강원',
          강원도: '강원',
          제주특별자치도: '제주',
          충청남도: '충남',
          경기도: '경기'
        })[name]
    )
  );
const key = (name, address) => `${normalize(name)}|${addressKey(address)}`;
const digest = (value) => createHash('sha256').update(value).digest('hex').slice(0, 20);
const readJson = async (file) =>
  JSON.parse((await readFile(resolve(input, file), 'utf8')).replace(/^\uFEFF/, ''));

const [candidates, gangwon, culture, analysis] = await Promise.all([
  readJson('normalized-candidate-places.json'),
  readJson('pettravel-all-details.json'),
  readJson('culture-travel-allowed.json'),
  readJson('analysis.json')
]);
if (!/^\d{4}-\d{2}-\d{2}$/.test(analysis.retrieved)) {
  throw new Error('The source collection date is required.');
}
const collectedAt = analysis.retrieved;
const gangwonById = new Map(gangwon.map((row) => [row.contentSeq, row]));
const cultureByKey = new Map();
for (const row of culture.toSorted((a, b) => a['최종작성일'].localeCompare(b['최종작성일']))) {
  cultureByKey.set(key(row['시설명'], row['도로명주소'] || row['지번주소']), row);
}

function sourceRecord(record) {
  if (record.source === 'gangwon') {
    const raw = gangwonById.get(record.id);
    if (!raw) throw new Error(`Missing Gangwon source ${record.id}`);
    return {
      provider: 'gangwon-pettravel',
      recordId: `gw-${record.id}`,
      url: `https://www.pettravel.kr/api/detailSeqPart.do?partCode=${raw.partCode}&contentNum=${record.id}`,
      collectedAt,
      updatedAt: null,
      verifiedAt: null,
      // Keep raw wording, including < vs <= weight limits and source disclaimers.
      policyText: raw.policyCautions ?? '',
      sizeText: String(raw.petWeight ?? ''),
      raw
    };
  }
  if (record.source === 'culture') {
    const raw = cultureByKey.get(key(record.name, record.address));
    if (!raw || raw['반려동물 동반 가능정보'] !== 'Y' || raw['최종작성일'] !== record.date) {
      throw new Error(`Missing or conflicting culture source: ${record.name}`);
    }
    return {
      provider: 'kcisa-pet-culture',
      // CSV provides no stable provider ID; this is a locally derived matching key.
      recordId: `kcisa-${digest(key(record.name, record.address))}`,
      url: urls.culture,
      collectedAt,
      updatedAt: record.date,
      verifiedAt: null,
      policyText: raw['반려동물 제한사항'] ?? '',
      sizeText: raw['입장 가능 동물 크기'] ?? '',
      raw
    };
  }
  throw new Error(`Unsupported source: ${record.source}`);
}

const output = new URL('../src/lib/server/data/regions/', import.meta.url);
const datasets = [];
const ids = new Set();
const index = {
  schemaVersion: 1,
  collectedAt,
  status: 'prepared',
  totalCandidates: 0,
  providers: {
    'gangwon-pettravel': { status: 'snapshot-collected', url: urls.gangwon },
    'kcisa-pet-culture': { status: 'csv-snapshot-collected', url: urls.culture },
    'kto-pet-tour': {
      status: 'not-collected-api-key-required',
      url: 'https://www.data.go.kr/data/15135102/openapi.do'
    },
    gocamping: {
      status: 'not-collected-api-key-required',
      url: 'https://www.data.go.kr/data/15101933/openapi.do'
    }
  },
  regions: {}
};

for (const [rankIndex, [regionId, province, city]] of definitions.entries()) {
  const selected = candidates.filter((row) => row.province === province && row.city === city);
  const expected = analysis.city_ranking.find((row) => row.region === `${province} ${city}`);
  if (!selected.length || selected.length !== expected?.candidate_places) {
    throw new Error(`Source count mismatch: ${regionId}`);
  }
  const places = selected.map((row) => {
    if (
      !Number.isFinite(row.lat) ||
      !Number.isFinite(row.lon) ||
      row.lat < -90 ||
      row.lat > 90 ||
      row.lon < -180 ||
      row.lon > 180 ||
      !row.name ||
      !row.address ||
      !['food', 'stay', 'outdoor', 'activity', 'culture'].includes(row.category)
    ) {
      throw new Error(`Invalid candidate: ${regionId}/${row.name}`);
    }
    const id = `region-${regionId}-${digest(key(row.name, row.address))}`;
    if (ids.has(id)) throw new Error(`Duplicate candidate ID: ${id}`);
    ids.add(id);
    const sources = row.records.map(sourceRecord);
    if (!sources.length) throw new Error(`Missing provenance: ${id}`);
    return {
      id,
      regionId,
      name: row.name,
      category: row.category,
      address: row.address,
      latitude: row.lat,
      longitude: row.lon,
      phone: row.phone,
      hours: row.hours,
      // This staging model intentionally does not claim that entry is verified.
      reviewStatus: 'unverified',
      sources
    };
  });
  const region = {
    id: regionId,
    rank: rankIndex + 1,
    province,
    city,
    candidateCount: places.length,
    decisionConditionCount: expected.decision_conditions
  };
  index.regions[regionId] = region;
  index.totalCandidates += places.length;
  datasets.push({ schemaVersion: 1, status: 'prepared', collectedAt, region, places });
}

// Validate all inputs before replacing any existing prepared snapshot.
await mkdir(output, { recursive: true });
for (const dataset of datasets) {
  await writeFile(
    new URL(`${dataset.region.id}.json`, output),
    JSON.stringify(dataset, null, 2) + '\n'
  );
}
await writeFile(new URL('index.json', output), JSON.stringify(index, null, 2) + '\n');
console.log(
  `Prepared ${datasets.length} regions / ${index.totalCandidates} candidates. No DB or UI changes.`
);
