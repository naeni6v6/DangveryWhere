// 강원 18개 시군구 지도 데이터 생성기 (지도 기록 페이지용)
// 실행: 프로젝트 루트에서  node assets/korea-maps/build_gangwon.mjs
// 결과: src/lib/domain/gangwonMap.ts
//
// 원본: https://github.com/swcho/korea-maps  svg/simple/강원도_시군구_경계.svg  (MIT, LICENSE 참고)
//       통계청 SGIS 오픈 API 2020년 행정구역 경계
//
// 원본 SVG 는 이미 단순화되어 있고 path 마다 id="춘천시" 처럼 이름이 붙어 있어,
// 좌표를 원점으로 당기고 소수점을 줄이는 정도만 합니다.
// 핀 자리는 도형 안에서 경계로부터 가장 먼 점(pole of inaccessibility)으로 잡아,
// 인제·홍천처럼 우묵한 모양에서도 핀이 밖으로 새지 않게 했어요.
import { readFileSync, writeFileSync } from 'node:fs';

const SRC =
  'https://raw.githubusercontent.com/swcho/korea-maps/main/svg/simple/%EA%B0%95%EC%9B%90%EB%8F%84_%EC%8B%9C%EA%B5%B0%EA%B5%AC_%EA%B2%BD%EA%B3%84.svg';
// 기록 저장 키인 SGIS 코드는 koreaDistricts.ts 가 가진 값을 그대로 씁니다(기록 호환).
const CODES_FILE = new URL('../../src/lib/domain/koreaDistricts.ts', import.meta.url);
const OUT = new URL('../../src/lib/domain/gangwonMap.ts', import.meta.url);
const PAD = 12; // 지도 가장자리 여백 (원본 좌표 기준)
const R = (n) => Math.round(n * 10) / 10;

const svg = await (await fetch(SRC)).text();
const paths = [...svg.matchAll(/<path\s+d="([^"]+)"\s+id="([^"]+)"\s*\/>/g)].map((m) => ({
  name: m[2],
  d: m[1]
}));
if (paths.length !== 18) throw new Error(`강원 시군구가 18개가 아니에요 (${paths.length}개). 원본 형식이 바뀐 것 같아요.`);

const codeSource = readFileSync(CODES_FILE, 'utf8');
const gangwon = /gangwon: \[([\s\S]*?)\n  \]/.exec(codeSource);
if (!gangwon) throw new Error('koreaDistricts.ts 에서 gangwon 목록을 못 찾았어요.');
const codeByName = new Map(
  [...gangwon[1].matchAll(/code: '(\d+)', name: '([^']+)'/g)].map((m) => [m[2], m[1]])
);

/** "M x y x y ... Z M ..." → 서브패스별 좌표 배열. 원본은 M 뒤가 모두 암묵적 lineto 예요. */
function rings(d) {
  return d
    .split('M')
    .map((part) => part.replace(/Z/g, '').trim())
    .filter(Boolean)
    .map((part) => {
      const nums = part.split(/[\s,]+/).map(Number);
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      return pts;
    })
    .filter((pts) => pts.length >= 3);
}

const parsed = paths.map((p) => ({ ...p, rings: rings(p.d) }));
const all = parsed.flatMap((p) => p.rings.flat());
const minX = Math.min(...all.map((p) => p[0])) - PAD;
const minY = Math.min(...all.map((p) => p[1])) - PAD;
const width = Math.max(...all.map((p) => p[0])) + PAD - minX;
const height = Math.max(...all.map((p) => p[1])) + PAD - minY;

const shift = (pts) => pts.map(([x, y]) => [x - minX, y - minY]);

function inside(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** 점에서 변까지의 최단 거리 (도형 안이면 양수로 쓰려고 부호는 따로 봅니다) */
function edgeDistance(pts, x, y) {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const dx = xj - xi;
    const dy = yj - yi;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - xi) * dx + (y - yi) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x - (xi + t * dx), y - (yi + t * dy)));
  }
  return best;
}

/** 도형 안에서 경계로부터 가장 먼 점. 성기게 훑고 그 주변을 다시 좁혀 들어갑니다. */
function poleOfInaccessibility(ring) {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, d: -1 };
  for (let pass = 0; pass < 4; pass++) {
    const stepX = (x1 - x0) / 40;
    const stepY = (y1 - y0) / 40;
    for (let x = x0; x <= x1; x += stepX) {
      for (let y = y0; y <= y1; y += stepY) {
        if (!inside(ring, x, y)) continue;
        const d = edgeDistance(ring, x, y);
        if (d > best.d) best = { x, y, d };
      }
    }
    [x0, x1, y0, y1] = [best.x - stepX, best.x + stepX, best.y - stepY, best.y + stepY];
  }
  return best;
}

const districts = parsed
  .map((place) => {
    const code = codeByName.get(place.name);
    if (!code) throw new Error(`koreaDistricts.ts 에 없는 시군구: ${place.name}`);
    const moved = place.rings.map(shift);
    // 핀은 가장 큰 덩어리 안에 둡니다 (섬이나 월경지에 찍히지 않도록).
    const area = (pts) =>
      Math.abs(
        pts.reduce((sum, [x, y], i) => {
          const [nx, ny] = pts[(i + 1) % pts.length];
          return sum + (x * ny - nx * y);
        }, 0) / 2
      );
    const main = moved.reduce((a, b) => (area(a) >= area(b) ? a : b));
    const pin = poleOfInaccessibility(main);
    return {
      code,
      name: place.name,
      d: moved
        .map((pts) => `M${pts.map(([x, y]) => `${R(x)},${R(y)}`).join(' ')}Z`)
        .join(' '),
      pinX: R(pin.x),
      pinY: R(pin.y)
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

const header = `/**
 * 강원 18개 시군구 경계 (지도 기록 페이지)
 *
 * 원본: swcho/korea-maps — svg/simple/강원도_시군구_경계.svg
 *       https://github.com/swcho/korea-maps  (MIT License, Copyright (c) 2022 StatGarten)
 *       통계청 SGIS 오픈 API 2020년 행정구역 경계
 * 생성: assets/korea-maps/build_gangwon.mjs 로 만들었어요. 손으로 고치지 말고 스크립트를 다시 실행하세요.
 *
 * code 는 koreaDistricts.ts 와 같은 SGIS 행정구역 코드예요. 기록을 그 키로 저장하고 있어서,
 * 전국 지도로 찍어 둔 강원 기록이 이 지도에서도 그대로 보입니다.
 * pinX·pinY 는 도형 안에서 경계로부터 가장 먼 점이라, 우묵한 시군구에서도 핀이 밖으로 새지 않아요.
 */
export type GangwonDistrict = {
  /** SGIS 행정구역 코드 (기록 저장 키) */
  code: string;
  name: string;
  d: string;
  pinX: number;
  pinY: number;
};

export const GANGWON_VIEWBOX = '0 0 ${R(width)} ${R(height)}';

export const gangwonDistricts: GangwonDistrict[] = [
`;
const body = districts
  .map(
    (d) =>
      `  { code: '${d.code}', name: '${d.name}', pinX: ${d.pinX}, pinY: ${d.pinY},\n    d: '${d.d}' }`
  )
  .join(',\n');

writeFileSync(OUT, `${header}${body}\n];\n`, 'utf8');
console.log(`강원 ${districts.length}개 시군구 · viewBox 0 0 ${R(width)} ${R(height)}`);
for (const d of districts) console.log(`  ${d.name} ${d.code} pin(${d.pinX}, ${d.pinY})`);
