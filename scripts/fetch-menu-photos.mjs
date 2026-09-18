// 메뉴 사진 받아 두기
// Usage: node scripts/fetch-menu-photos.mjs
//
// src/lib/data/placeMenus.json 의 photo 칸에 적힌 원본 사진 주소를 받아
// static/menus/<장소id>-<번호>.webp (가로 480px) 로 저장하고, photo 를 '/menus/...' 로 바꿉니다.
// 이미 '/menus/' 로 적힌 줄은 건너뜁니다. (장소 대표 사진의 fetch-place-images.mjs 와 같은 방식)
//
// 남의 서버 주소를 화면에 그대로 거는 대신 받아서 우리 쪽에서 내보내는 이유는
// 사진이 언제 사라질지 모르고, 장당 용량도 웹에 그대로 쓰기엔 크기 때문이에요.
// 넣어도 되는 사진인지는 이 스크립트가 판단하지 않습니다. docs/MENU_BOARD_GUIDE.txt 3절을 보세요.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const FILE = 'src/lib/data/placeMenus.json';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  throw new Error('sharp 가 필요해요: npm install --no-save sharp');
}

const board = JSON.parse(await readFile(FILE, 'utf8'));
const places = Object.entries(board.places ?? {});
await mkdir('static/menus', { recursive: true });

const failed = [];
let saved = 0;
for (const [placeId, place] of places) {
  for (const [index, item] of (place.items ?? []).entries()) {
    const source = item.photo?.trim();
    // 이미 받아 둔 사진(/menus/...)과 사진이 없는 줄은 그대로 둡니다.
    if (!source || !/^https?:\/\//.test(source)) continue;
    const name = `${placeId}-${index + 1}.webp`;
    try {
      const response = await fetch(source, {
        headers: { 'User-Agent': 'DangveryWhere/0.1 (menu photos)' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await sharp(buffer)
        .rotate()
        .resize({ width: 480, height: 480, fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(`static/menus/${name}`);
      item.photo = `/menus/${name}`;
      saved += 1;
      process.stdout.write('.');
    } catch (error) {
      failed.push(`${placeId} ${item.name} (${error.message})`);
    }
  }
}

await writeFile(FILE, JSON.stringify(board, null, 2) + '\n');
console.log(`\n메뉴 사진 ${saved}장 저장 (가게 ${places.length}곳)`);
if (failed.length) console.log('실패:\n  ' + failed.join('\n  '));
