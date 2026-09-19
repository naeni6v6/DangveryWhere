// 업소 홈페이지 대표 사진 가져오기
// Usage: node scripts/fetch-homepage-photos.mjs            # 저장
//        node scripts/fetch-homepage-photos.mjs --dry-run  # 무엇을 받을지만 출력
//
// 어떤 장소를 도나요?
//  - src/lib/server/data/homepage-photos.json 에 적힌 장소만. 이 목록은 자동 수집이 아니라
//    사진이 없는 장소의 홈페이지(원본 데이터의 homePage·'홈페이지' 칸)를 하나씩 열어
//    og:image 나 첫 화면 사진 줄에서 사람이 고른 한 장입니다. 로고·배너·공지 이미지는 뺐어요.
//    경위는 docs/REGION_DATA_GUIDE.txt 9절.
//
// 어디에 저장하나요?
//  - static/places/homepage/<id>.webp (표지용 900px). 관광공사 사진과 달리 업소 사이트 사진은
//    http 전용 호스트가 많아(인증서 만료·자체서명) https 배포에서 핫링크가 막힙니다.
//    그래서 pettravel 사진처럼 받아 두고, 화면에는 photoCredit()(region.ts)이
//    '사진: 업소 홈페이지' 를 붙입니다.
//  - hotlink: true 인 항목(관광공사 visitkorea CDN)은 받지 않고 원본 주소를 그대로 겁니다.
//    공공누리 제3유형(변경금지)일 수 있어 줄이지 않아요.
//
// placeImages.json 에는 사진이 없던 장소만 새로 넣고, 이미 있는 장소는 뒤에 덧붙입니다.
// 여러 번 돌려도 결과는 같습니다.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LIST = new URL('../src/lib/server/data/homepage-photos.json', import.meta.url);
const IMAGES = new URL('../src/lib/data/placeImages.json', import.meta.url);
const OUT_DIR = new URL('../static/places/homepage/', import.meta.url);
const COVER = { width: 900, height: 600 };
const dryRun = process.argv.includes('--dry-run');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  throw new Error('sharp 가 필요해요: npm install --no-save sharp');
}

async function download(url, referer) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DangveryWhere/0.1 (place photos)',
      Referer: referer
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000)
  });
  const type = response.headers.get('content-type') ?? '';
  if (response.status !== 200 || !type.startsWith('image/')) {
    throw new Error(`${response.status} ${type}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const { photos } = JSON.parse(await readFile(LIST, 'utf8'));
const imagesText = await readFile(IMAGES, 'utf8');
const newline = imagesText.includes('\r\n') ? '\r\n' : '\n';
const images = JSON.parse(imagesText);

let saved = 0;
let linked = 0;
let failed = 0;
if (!dryRun) await mkdir(OUT_DIR, { recursive: true });

for (const photo of photos) {
  const current = images[photo.id] ?? [];
  const entry = photo.hotlink ? photo.image : `/places/homepage/${photo.id}.webp`;
  if (current.includes(entry)) {
    console.log(`= ${photo.name}: 이미 있음`);
    continue;
  }
  if (dryRun) {
    console.log(`? ${photo.name}: ${photo.hotlink ? '원본 주소' : '내려받기'} ${photo.image}`);
    continue;
  }
  if (!photo.hotlink) {
    try {
      const body = await download(photo.image, photo.page);
      await sharp(body)
        .rotate()
        .resize({ ...COVER, fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 76 })
        .toFile(fileURLToPath(new URL(`${photo.id}.webp`, OUT_DIR)));
      saved += 1;
    } catch (error) {
      failed += 1;
      console.log(`x ${photo.name}: ${error.message}`);
      continue;
    }
  } else {
    linked += 1;
  }
  images[photo.id] = [...current, entry];
  console.log(`+ ${photo.name}: ${entry}`);
}

if (!dryRun) {
  // 기존 파일과 같은 한 칸 들여쓰기(fetch-place-images.mjs 가 그렇게 씁니다).
  await writeFile(IMAGES, JSON.stringify(images, null, 1).replace(/\n/g, newline) + newline);
}
console.log(`저장 ${saved} · 원본 주소 ${linked} · 실패 ${failed} · 목록 ${photos.length}`);
