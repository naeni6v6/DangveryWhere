// 식음료(food) 장소를 카페 / 식당으로 나눠 gangneung.json 의 foodKind 를 채웁니다.
//
// 원본 API 는 식음료를 한 덩어리로 주지만, 상세 페이지에는 '#카페', '#식당', '#디저트'
// 같은 키워드 태그가 붙어 있습니다. 이름으로 추측하지 않고 그 태그를 근거로 가릅니다.
//
//   node scripts/import-gangneung.mjs <스냅샷>   ← 먼저 실행
//   node scripts/classify-food.mjs               ← 그 다음 실행
//
// 주의: pettravel.kr 인증서가 2026-09-10 에 만료되어 기본 설정으로는 접속이 막힙니다.
// 만료된 동안에만 아래 명령으로 우회해 주세요(공개 데이터 읽기 전용).
//   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/classify-food.mjs
import { readFile, writeFile } from 'node:fs/promises';

const DATA = 'src/lib/server/data/gangneung.json';
// 앞쪽 태그일수록 그 가게의 정체성에 가깝습니다. 카페/식당 신호를 각각 모아 비교합니다.
const CAFE = /^(카페|애견카페|커피|디저트|베이커리|브런치|마카롱|빵|제과)/;
const RESTAURANT =
  /^(식당|맛집|레스토랑|포차|펍|바|횟집|국수|막국수|회|물회|수육|두부|전골|버거|수제버거|피자|파스타|바베큐|BBQ|샤브샤브|해산물|해물|조개|구이|술|맥주|수제맥주|위스키|칵테일|라운지|프렌치|프랑스가정식|퓨전|스테이크|아메리칸|무한리필)$/;

function classify(tags) {
  const cafe = tags.filter((tag) => CAFE.test(tag)).length;
  const restaurant = tags.filter((tag) => RESTAURANT.test(tag)).length;
  if (cafe === 0 && restaurant === 0) return null;
  // '카페루아'(#카페 #식당 #애견카페)처럼 둘 다 달린 곳은 카페 신호가 많은 쪽을 따릅니다.
  return cafe >= restaurant ? 'cafe' : 'restaurant';
}

async function fetchTags(id) {
  const seq = id.replace(/^gw-/, '');
  const response = await fetch(`https://www.pettravel.kr/petapi/data/food?contentSeq=${seq}`);
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
  const lines = (await response.text())
    .replace(/<[^>]*>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const start = lines.indexOf('키워드');
  if (start === -1) return [];
  const tags = [];
  for (let i = start + 1; i < lines.length && lines[i].startsWith('#'); i++)
    tags.push(lines[i].replace(/^#\s*/, '').trim());
  return tags;
}

const places = JSON.parse(await readFile(DATA, 'utf8'));
let cafe = 0;
let restaurant = 0;
const unknown = [];
for (const place of places) {
  if (place.category !== 'food') {
    place.foodKind = null;
    continue;
  }
  const kind = classify(await fetchTags(place.id));
  place.foodKind = kind;
  if (kind === 'cafe') cafe++;
  else if (kind === 'restaurant') restaurant++;
  else unknown.push(place.name);
}
await writeFile(DATA, JSON.stringify(places, null, 2) + '\n');
console.log(`카페 ${cafe}곳 · 식당 ${restaurant}곳으로 나눴습니다.`);
if (unknown.length) console.warn(`태그로 못 가른 곳(식당으로 표시됨): ${unknown.join(', ')}`);
