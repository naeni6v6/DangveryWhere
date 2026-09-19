// 한국관광공사 반려동물 동반여행 서비스(KorPetTourService2) 강원 전량 수집
// Usage: node --env-file=.env scripts/fetch-kto-pet-tour.mjs
//
// 결과: src/lib/server/data/kto-pet-tour.json  (contentid 를 키로 한 원문 저장본)
//
// 왜 areaCode 를 안 쓰나요?
//  - 이 API 는 레코드 상당수의 areacode 칸이 비어 있습니다. areaCode=32(강원)로 조회하면
//    127건만 나오고, 법정동 코드(lDongRegnCd=51)로 조회하면 394건이 나옵니다.
//    전국 9,677건을 전량 받아 주소로 걸러도 394건으로 같아서, 법정동 코드를 씁니다.
//
// 왜 detailImage2 까지 부르나요?
//  - firstimage 가 비었다고 사진이 없는 게 아닙니다. 감자밭(2807380)은 firstimage 가
//    빈 문자열인데 detailImage2 에는 3장이 있어요. 사진 유무는 두 곳을 합쳐 판단합니다.
//
// 저작권(cpyrhtDivCd)
//  - Type1 은 공공누리 제1유형(출처표시), Type3 은 제3유형(출처표시 + 변경금지)입니다.
//    강원 394건 중 Type3 이 282건이라, 이 저장본의 사진은 변형(리사이즈/크롭)하지 않고
//    원본 URL 을 그대로 씁니다. pettravel 사진처럼 webp 로 줄이지 않아요.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const KEY = process.env.DATA_GO_KR_SERVICE_KEY;
if (!KEY) throw new Error('DATA_GO_KR_SERVICE_KEY 가 없어요. node --env-file=.env 로 실행해 주세요.');

const BASE = 'https://apis.data.go.kr/B551011/KorPetTourService2';
/** 법정동 시도코드. 51 = 강원특별자치도. */
const GANGWON = 51;
const OUTPUT = new URL('../src/lib/server/data/kto-pet-tour.json', import.meta.url);
/** 동시 요청 수. 공공데이터포털 기본 트래픽(일 10,000)에 여유를 두려고 낮게 잡았습니다. */
const WORKERS = 4;

async function call(operation, params, tries = 3) {
  const url = new URL(`${BASE}/${operation}`);
  url.searchParams.set('serviceKey', KEY);
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', 'DangveryWhere');
  url.searchParams.set('_type', 'json');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const text = await response.text();
      const parsed = JSON.parse(text);
      const header = parsed?.response?.header;
      if (header && header.resultCode !== '0000') {
        throw new Error(`${operation} ${header.resultCode} ${header.resultMsg}`);
      }
      const body = parsed?.response?.body;
      if (!body) throw new Error(`${operation} 응답 형식이 달라요: ${text.slice(0, 200)}`);
      const item = body.items?.item;
      return { total: body.totalCount ?? 0, items: Array.isArray(item) ? item : item ? [item] : [] };
    } catch (cause) {
      if (attempt === tries) throw new Error(`${operation} 실패 (${JSON.stringify(params)})`, { cause });
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
}

/** 목록을 끝까지 넘겨 가며 받습니다. contentid 가 겹치면 뒤엣것을 버립니다. */
async function collectList() {
  const rows = new Map();
  let page = 1;
  let total = 0;
  do {
    const { total: reported, items } = await call('areaBasedList2', {
      lDongRegnCd: GANGWON,
      numOfRows: 100,
      pageNo: page,
      arrange: 'C'
    });
    total = reported;
    for (const item of items) if (!rows.has(item.contentid)) rows.set(item.contentid, item);
    page += 1;
  } while (rows.size < total && page < 60);
  if (rows.size !== total) {
    throw new Error(`목록 수집이 모자라요: ${rows.size}/${total}`);
  }
  return [...rows.values()];
}

/** 상세 네 가지를 한 장소에 대해 모읍니다. 한 건이 비어도 나머지는 남깁니다. */
async function collectDetail(row) {
  const [common, intro, pet, images] = await Promise.all([
    call('detailCommon2', { contentId: row.contentid }).catch(() => ({ items: [] })),
    call('detailIntro2', { contentId: row.contentid, contentTypeId: row.contenttypeid }).catch(
      () => ({ items: [] })
    ),
    call('detailPetTour2', { contentId: row.contentid }).catch(() => ({ items: [] })),
    call('detailImage2', { contentId: row.contentid, imageYN: 'Y', numOfRows: 30 }).catch(() => ({
      items: []
    }))
  ]);
  const gallery = images.items.map((image) => image.originimgurl).filter(Boolean);
  const photos = [];
  for (const url of [row.firstimage, ...gallery]) if (url && !photos.includes(url)) photos.push(url);
  return {
    contentid: row.contentid,
    contenttypeid: row.contenttypeid,
    list: row,
    common: common.items[0] ?? null,
    intro: intro.items[0] ?? null,
    pet: pet.items[0] ?? null,
    photos,
    // 공공누리 유형. 빈 값이면 알 수 없다는 뜻이라, 변형하지 않는 쪽으로 다룹니다.
    copyright: row.cpyrhtDivCd || common.items[0]?.cpyrhtDivCd || ''
  };
}

const started = new Date();
process.stdout.write('목록 수집 중... ');
const list = await collectList();
console.log(`강원 ${list.length}건`);

const records = {};
const queue = [...list];
let done = 0;
async function worker() {
  while (queue.length) {
    const row = queue.shift();
    records[row.contentid] = await collectDetail(row);
    done += 1;
    if (done % 50 === 0) process.stdout.write(`${done}/${list.length} `);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log('');

const snapshot = {
  schemaVersion: 1,
  provider: 'kto-pet-tour',
  service: 'KorPetTourService2',
  url: 'https://www.data.go.kr/data/15135102/openapi.do',
  // 공공누리 출처표시 의무가 있어, 화면 문구가 읽을 저작권자를 저장본에 남깁니다.
  attribution: '한국관광공사',
  filter: { lDongRegnCd: GANGWON, region: '강원특별자치도' },
  collectedAt: started.toISOString().slice(0, 10),
  count: Object.keys(records).length,
  records
};

await mkdir(new URL('.', OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(snapshot, null, 1) + '\n');

const values = Object.values(records);
const withPhotos = values.filter((record) => record.photos.length);
const copyrights = {};
for (const record of values) copyrights[record.copyright || '(빈값)'] = (copyrights[record.copyright || '(빈값)'] ?? 0) + 1;
console.log(`저장 ${values.length}건 → src/lib/server/data/kto-pet-tour.json`);
console.log(`사진 있는 곳 ${withPhotos.length}건 / 총 ${withPhotos.reduce((sum, r) => sum + r.photos.length, 0)}장`);
console.log('공공누리 유형:', copyrights);
