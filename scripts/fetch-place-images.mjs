// 장소 사진 가져오기
// Usage: node scripts/fetch-place-images.mjs
//
// 강원 반려동물 동반관광 OpenAPI(detailSeqPart.do)의 imageList 에서 장소별 사진을 최대 5장까지 받아
//   static/places/<id>.webp    (첫 장, 표지용 900px)
//   static/places/<id>-2.webp  (나머지, 가게 사진 줄용 640px)
// 로 저장하고, src/lib/data/placeImages.json 에 장소별 목록을 씁니다.
//
// 어느 장소를 도나요?
//  - 강릉 스냅샷(gangneung.json)과 화면에 연결된 지역(domain/region.ts 의 regionCatalog) 전부.
//    사진은 강원 원본(gangwon-pettravel)에서만 나와서, 그 출처가 없는 장소는 건너뜁니다.
//    (문화정보원 자료만 있는 장소에는 사진 칸 자체가 없어요.)
//
// 왜 원본 URL 을 바로 쓰지 않나요?
//  - API 가 주는 이미지 주소가 http:// 이고, 사이트 인증서가 만료돼 https 로는 열리지 않아요.
//    배포(https) 환경에서는 브라우저가 막기 때문에 사진을 받아 우리 서버에서 제공합니다.
//  - 원본은 장당 1MB 안팎이라 웹용으로 줄여 저장해요.
//
// 인증서 검증 예외는 이 스크립트의 pettravel.kr 요청에만 적용됩니다. (공개 데이터 읽기 전용)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import https from 'node:https';

const HOST = 'www.pettravel.kr';
const partCodes = { food: 'PC01', stay: 'PC02', outdoor: 'PC03', activity: 'PC04' };
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
/** 한 장소에서 가져올 사진 수. 원본도 대개 3~5장이라 이 이상은 거의 없습니다. */
const MAX_PHOTOS = 5;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  throw new Error('sharp 가 필요해요: npm install --no-save sharp');
}

function get(path, redirects = 3) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      { host: HOST, path, agent, headers: { 'User-Agent': 'DangveryWhere/0.1 (place images)' } },
      (response) => {
        const { statusCode = 0, headers } = response;
        if (statusCode >= 300 && statusCode < 400 && headers.location && redirects > 0) {
          response.resume();
          const next = new URL(headers.location, `https://${HOST}`);
          if (next.host !== HOST) return reject(new Error(`unexpected redirect host ${next.host}`));
          return resolve(get(next.pathname + next.search, redirects - 1));
        }
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: statusCode,
            type: headers['content-type'] ?? '',
            body: Buffer.concat(chunks)
          })
        );
      }
    );
    request.setTimeout(20000, () => request.destroy(new Error('timeout')));
    request.on('error', reject);
  });
}

async function imagePathsFor(place) {
  const res = await get(
    `/api/detailSeqPart.do?partCode=${partCodes[place.category]}&contentNum=${place.seq}`
  );
  const data = JSON.parse(res.body.toString('utf8'));
  const list = data?.[0]?.resultList?.imageList ?? [];
  const paths = list
    .map((item) => {
      try {
        const url = new URL(item.image);
        return url.host === HOST && /^\/upload\/mapdata\//.test(url.pathname) ? url.pathname : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  // 같은 사진이 두 번 들어 있는 원본이 있어 중복은 걸러 냅니다.
  return [...new Set(paths)].slice(0, MAX_PHOTOS);
}

/**
 * 사진 한 장을 받아 webp 로 저장합니다. 저장했으면 true.
 * 목록용 썸네일(282px) 대신 원본을 먼저 쓰고, 원본이 없거나 깨져 있으면 썸네일로 넘어갑니다.
 * (원본 JPEG 이 깨져 sharp 가 뱉는 곳이 실제로 있어서, 받는 것과 읽는 것을 함께 겁니다.)
 */
async function savePhoto(thumbPath, name, size) {
  for (const path of [thumbPath.replace('/thumb/list/', '/'), thumbPath]) {
    try {
      const res = await get(path);
      if (res.status !== 200 || !res.type.startsWith('image/') || res.body.length <= 2000) continue;
      await sharp(res.body)
        .rotate()
        .resize({ ...size, fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 76 })
        .toFile(`static/places/${name}`);
      return true;
    } catch {
      // 이 주소로는 실패. 다음 후보로 넘어갑니다.
    }
  }
  return false;
}

/** 강원 원본의 일련번호. 강릉 스냅샷은 id 가, 지역 데이터는 출처의 recordId 가 'gw-194' 꼴입니다. */
function seqOf(place) {
  if (/^gw-\d+$/.test(place.id)) return place.id.slice(3);
  for (const source of place.sources ?? []) {
    if (source.provider === 'gangwon-pettravel' && /^gw-\d+$/.test(source.recordId))
      return source.recordId.slice(3);
  }
  return null;
}

async function loadPlaces() {
  const seen = new Set();
  const places = [];
  const add = (place) => {
    const seq = seqOf(place);
    // 사진은 강원 원본에만 있고, 카테고리 4종(식음료·숙소·관광·체험)만 API 를 엽니다.
    if (!seq || !partCodes[place.category] || seen.has(place.id)) return;
    seen.add(place.id);
    places.push({ id: place.id, name: place.name, category: place.category, seq });
  };

  const gangneung = JSON.parse(await readFile('src/lib/server/data/gangneung.json', 'utf8'));
  for (const place of gangneung) add(place);

  // 화면에 연결된 지역만 돕니다. 목록은 regionCatalog 하나로 두려고 그 파일에서 읽어 옵니다.
  // (저장본만 남겨 둔 지역까지 돌면 화면에 안 쓰는 사진을 받게 돼요.)
  const catalog = await readFile('src/lib/domain/region.ts', 'utf8');
  const ids = [...catalog.matchAll(/id: '([a-z-]+)'/g)]
    .map(([, id]) => id)
    .filter((id) => id !== 'all');
  for (const id of ids) {
    let data;
    try {
      data = JSON.parse(await readFile(`src/lib/server/data/regions/${id}.json`, 'utf8'));
    } catch {
      // 강릉처럼 지역 저장본이 없는 곳(DB 스냅샷으로 들어옴)은 위에서 이미 담았습니다.
      continue;
    }
    for (const place of data.places ?? []) add(place);
  }
  return places;
}

const places = await loadPlaces();
await mkdir('static/places', { recursive: true });
await mkdir('src/lib/data', { recursive: true });

const result = {};
const failed = [];
let cursor = 0;
async function worker() {
  while (cursor < places.length) {
    const place = places[cursor++];
    try {
      const paths = await imagePathsFor(place);
      const saved = [];
      for (const path of paths) {
        // 첫 장은 표지(넓게), 나머지는 사진 줄(작게) 용도라 크기를 달리 둡니다.
        // 자리는 받은 순서가 아니라 '실제로 저장한 순서'로 매깁니다. 한 장이 깨져도 번호가 안 빕니다.
        const first = saved.length === 0;
        const name = first ? `${place.id}.webp` : `${place.id}-${saved.length + 1}.webp`;
        const size = first ? { width: 900, height: 600 } : { width: 640, height: 480 };
        if (await savePhoto(path, name, size)) saved.push(`/places/${name}`);
      }
      if (!saved.length) {
        failed.push(`${place.id} ${place.name} (사진 없음)`);
        continue;
      }
      result[place.id] = saved;
      process.stdout.write('.');
    } catch (error) {
      failed.push(`${place.id} ${place.name} (${error.message})`);
    }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
const photos = Object.values(sorted).reduce((n, list) => n + list.length, 0);
await writeFile('src/lib/data/placeImages.json', JSON.stringify(sorted, null, 2) + '\n');
console.log(
  `\n사진 ${photos}장 / ${Object.keys(sorted).length}곳 저장 (돌아본 곳 ${places.length})`
);
if (failed.length) console.log('사진 없음/실패:\n  ' + failed.join('\n  '));
