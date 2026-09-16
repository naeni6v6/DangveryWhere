// 강릉 동물병원을 gangneung.json 에 더합니다.
//
//   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/import-hospitals.mjs
//   (인증서가 2026-09-10 에 만료되어, 갱신 전까지는 위 우회가 필요합니다)
//
// 동물병원 목록 페이지(/petapi/data/hospital)에는 좌표가 없지만, 같은 사이트의
// 지도 화면이 쓰는 /others/map/content/find 가 좌표까지 함께 내려 줍니다.
// 주소를 지오코딩하지 않고 원본 좌표를 그대로 받아 오는 쪽이 정확합니다.
//
// 이 분류는 웹(PC) 전용입니다. 모바일 앱(/) 은 routes/+page.server.ts 에서 걸러냅니다.
import { readFile, writeFile } from 'node:fs/promises';

const ORIGIN = 'https://www.pettravel.kr';
const DATA = 'src/lib/server/data/gangneung.json';
const AREA = '강릉시';

const mapPage = await fetch(`${ORIGIN}/petapi/map`);
if (!mapPage.ok) throw new Error(`지도 페이지를 열지 못했습니다: HTTP ${mapPage.status}`);
const cookie = (mapPage.headers.getSetCookie?.() ?? [])
  .map((value) => value.split(';')[0])
  .join('; ');
const html = await mapPage.text();
const token = html.match(/<meta name="_csrf" content="([^"]+)"/)?.[1];
if (!token) throw new Error('CSRF 토큰을 찾지 못했습니다. 원본 페이지 구조가 바뀐 것 같아요.');

const response = await fetch(`${ORIGIN}/others/map/content/find`, {
  method: 'POST',
  headers: {
    'X-XSRF-TOKEN': token,
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    Referer: `${ORIGIN}/petapi/map`,
    cookie
  },
  // PC05 = 동물병원·약국
  body: 'areaCode=&partCode=PC05&searchKeywordTo='
});
const payload = await response.json();
if (payload.result !== 'success') throw new Error('원본이 success 를 주지 않았습니다.');

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const hospitals = payload.positions
  .filter((row) => row.areaName === AREA)
  .map((row) => ({
    id: `gw-h-${row.seq}`,
    name: clean(row.title),
    category: 'hospital',
    foodKind: null,
    address: clean(row.address),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: clean(row.phone),
    // 원본이 동물병원에는 소개·운영시간·동반 규정을 주지 않습니다.
    // 없는 정보를 지어내지 않고 비워 둡니다. 화면은 빈 값을 감안해 표시합니다.
    description: '',
    policy: '',
    hours: '',
    sourceUrl: `${ORIGIN}/petapi/data/hospital`,
    importedAt: new Date().toISOString().slice(0, 10),
    verifiedAt: null,
    sourceWeight: null
  }));

if (!hospitals.length) throw new Error(`${AREA} 동물병원을 한 곳도 찾지 못했습니다.`);
if (hospitals.some((row) => !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)))
  throw new Error('좌표가 비어 있는 행이 있습니다.');

const places = JSON.parse(await readFile(DATA, 'utf8'));
const kept = places.filter((place) => place.category !== 'hospital');
const merged = [...kept, ...hospitals];
if (new Set(merged.map((place) => place.id)).size !== merged.length)
  throw new Error('id 가 겹칩니다.');

await writeFile(DATA, JSON.stringify(merged, null, 2) + '\n');
console.log(`${AREA} 동물병원 ${hospitals.length}곳을 넣었습니다. (전체 ${merged.length}건)`);
