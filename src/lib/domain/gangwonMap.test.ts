import { describe, expect, it } from 'vitest';
import { GANGWON_VIEWBOX, gangwonDistricts } from './gangwonMap';
import { koreaDistricts } from './koreaDistricts';

const [, , width, height] = GANGWON_VIEWBOX.split(' ').map(Number);

/** "M x,y x,y ... Z" 한 덩어리씩 좌표로 되돌립니다. */
function rings(d: string): [number, number][][] {
  return d
    .split('M')
    .map((part) => part.replace('Z', '').trim())
    .filter(Boolean)
    .map((part) => part.split(' ').map((pair) => pair.split(',').map(Number) as [number, number]));
}

/** 짝수-홀수 규칙으로 점이 도형 안에 있는지 (핀이 제 시군구 안에 있는지 보려고) */
function inside(ring: [number, number][], [x, y]: [number, number]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe('the Gangwon map the record page draws', () => {
  it('has every one of the 18 districts, and no one else', () => {
    expect(gangwonDistricts).toHaveLength(18);
    expect(gangwonDistricts.map((district) => district.name).sort()).toEqual(
      koreaDistricts.gangwon.map((district) => district.name).sort()
    );
  });

  it('keeps the same codes the visit records are saved under', () => {
    // 기록은 SGIS 코드로 저장됩니다. 이 값이 어긋나면 전국 지도 시절의 기록이 사라져 보여요.
    const byName = new Map(koreaDistricts.gangwon.map((d) => [d.name, d.code]));
    for (const district of gangwonDistricts) expect(district.code).toBe(byName.get(district.name));
  });

  it('draws every shape inside the viewBox', () => {
    for (const district of gangwonDistricts) {
      const points = rings(district.d).flat();
      expect(points.length).toBeGreaterThan(2);
      for (const [x, y] of points) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(width);
        expect(y).toBeLessThanOrEqual(height);
      }
    }
  });

  it('puts each pin inside its own district, not just near it', () => {
    // 인제·홍천처럼 우묵한 모양에서는 무게중심이 도형 밖으로 나갑니다. 그래서 생성기가
    // 경계에서 가장 먼 점을 찾아 두고, 여기서 실제로 안에 있는지 확인합니다.
    for (const district of gangwonDistricts) {
      const pin: [number, number] = [district.pinX, district.pinY];
      expect(rings(district.d).some((ring) => inside(ring, pin))).toBe(true);
    }
  });
});
