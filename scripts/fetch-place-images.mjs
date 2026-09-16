// 장소 대표 사진 가져오기
// Usage: node scripts/fetch-place-images.mjs
//
// 강원 반려동물 동반관광 OpenAPI(detailSeqPart.do)의 imageList 에서 장소별 첫 사진을 받아
// static/places/<id>.webp (가로 900px) 로 저장하고, src/lib/data/placeImages.json 에 목록을 씁니다.
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
          resolve({ status: statusCode, type: headers['content-type'] ?? '', body: Buffer.concat(chunks) })
        );
      }
    );
    request.setTimeout(20000, () => request.destroy(new Error('timeout')));
    request.on('error', reject);
  });
}

async function imagePathsFor(place) {
  const seq = place.id.replace(/^gw-/, '');
  const res = await get(`/api/detailSeqPart.do?partCode=${partCodes[place.category]}&contentNum=${seq}`);
  const data = JSON.parse(res.body.toString('utf8'));
  const list = data?.[0]?.resultList?.imageList ?? [];
  return list
    .map((item) => {
      try {
        const url = new URL(item.image);
        return url.host === HOST && /^\/upload\/mapdata\//.test(url.pathname) ? url.pathname : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function downloadImage(thumbPath) {
  // 목록용 썸네일(282px) 대신 원본을 먼저 시도하고, 없으면 썸네일로 대체
  for (const path of [thumbPath.replace('/thumb/list/', '/'), thumbPath]) {
    const res = await get(path);
    if (res.status === 200 && res.type.startsWith('image/') && res.body.length > 2000) return res.body;
  }
  return null;
}

const places = JSON.parse(await readFile('src/lib/server/data/gangneung.json', 'utf8'));
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
      const buffer = paths.length ? await downloadImage(paths[0]) : null;
      if (!buffer) {
        failed.push(`${place.id} ${place.name} (사진 없음)`);
        continue;
      }
      await sharp(buffer)
        .rotate()
        .resize({ width: 900, height: 600, fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 76 })
        .toFile(`static/places/${place.id}.webp`);
      result[place.id] = `/places/${place.id}.webp`;
      process.stdout.write('.');
    } catch (error) {
      failed.push(`${place.id} ${place.name} (${error.message})`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
await writeFile('src/lib/data/placeImages.json', JSON.stringify(sorted, null, 2) + '\n');
console.log(`\n사진 ${Object.keys(sorted).length}/${places.length}곳 저장`);
if (failed.length) console.log('사진 없음/실패:\n  ' + failed.join('\n  '));
