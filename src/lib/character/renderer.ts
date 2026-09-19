/**
 * 캐릭터 꾸미기 캔버스.
 *
 * AI 가 만든 그림은 한 장짜리 래스터라 부품을 갈아 끼울 수 없어요. 대신 부위 위치(layout)를
 * 기준으로 두 가지를 브라우저에서 바로 처리합니다.
 *  1. 재채색 — 털 색상 프리셋을 고르면 주된 털 영역만 색조·명도를 옮깁니다. 눈·코·입, 흰 무늬,
 *     분홍 귀 속, 바닥 그림자는 건드리지 않아요.
 *  2. 국소 워프 — 눈·얼굴·귀·머리·꼬리·몸 둘레에 부드러운 확대/축소 장(field)을 걸어
 *     게임 캐릭터 슬라이더처럼 비율을 바꿉니다. 경계가 매끄럽게 이어져서 잘라 붙인 티가 안 나요.
 * 슬라이더를 움직일 때마다 AI 를 부르지 않는 이유가 이 파일입니다.
 */
import {
  eyeShapes,
  furColors,
  layoutFromBounds,
  type Box,
  type CharacterLayout,
  type CharacterParams,
  type FurColorKey
} from '$lib/domain/character';

type Field = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  kx: number;
  ky: number;
  dx: number;
  dy: number;
  /** 이 반지름 비율까지는 100% 적용, 그 바깥에서 가장자리까지 서서히 0 으로 */
  plateau: number;
};

export type RendererOptions = {
  /** AI 가 찾은 부위. 없으면 강아지 영역에서 대략 잡습니다. */
  layout?: CharacterLayout | null;
  /** AI 가 읽은 원래 털 색. 이 프리셋을 고르면 재채색을 하지 않아요. */
  originalColor: FurColorKey;
  /** 귀가 머리에 붙은 쪽. 쫑긋한 귀는 아래, 늘어진 귀는 위가 고정점이 됩니다. */
  earAnchor?: 'top' | 'bottom' | 'center';
  /** 작업 해상도 상한. 원본이 더 크면 줄여서 읽습니다. */
  maxSize?: number;
};

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}
function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}
function hexToHsl(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgbToHsl(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
};

async function decode(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  await image.decode();
  return image;
}

export class CharacterRenderer {
  readonly width: number;
  readonly height: number;
  /** 강아지(그림자 포함)가 차지하는 영역, 0~1 */
  readonly bounds: Box;
  readonly layout: CharacterLayout;
  readonly originalColor: FurColorKey;
  readonly #earAnchor: 'top' | 'bottom' | 'center';
  /** 배경을 흰색으로 칠한 불투명 RGBA */
  readonly #rgba: Uint8ClampedArray;
  /** 강아지 마스크 (0 = 배경) */
  readonly #alpha: Uint8Array;
  readonly #hsl: Float32Array;
  /** 픽셀마다 재채색을 얼마나 적용할지 0~1 */
  readonly #furWeight: Float32Array;
  readonly #lRef: number;
  readonly #recolorCache = new Map<FurColorKey, Uint8ClampedArray>();

  private constructor(image: ImageData, options: RendererOptions) {
    this.width = image.width;
    this.height = image.height;
    this.originalColor = options.originalColor;
    this.#earAnchor = options.earAnchor ?? 'center';
    const count = this.width * this.height;
    this.#rgba = new Uint8ClampedArray(image.data);
    this.#alpha = new Uint8Array(count);
    this.#hsl = new Float32Array(count * 3);
    this.#furWeight = new Float32Array(count);

    this.#cutBackground();
    this.bounds = this.#measureBounds();
    this.layout = options.layout ?? layoutFromBounds(this.bounds);
    const stats = this.#measureFur();
    this.#lRef = stats.l;
    this.#weighFur(stats);
  }

  static async load(src: string, options: RendererOptions): Promise<CharacterRenderer> {
    const image = await decode(src);
    const max = options.maxSize ?? 768;
    const ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(image, 0, 0, width, height);
    return new CharacterRenderer(ctx.getImageData(0, 0, width, height), options);
  }

  /**
   * 배경을 찾아 지웁니다. 테두리에서 시작해 배경색과 거의 같은 픽셀만 채워 나가서,
   * 흰 강아지의 몸속까지 파고들지 않게 합니다 (털은 배경보다 따뜻한 색을 띠어요).
   */
  #cutBackground() {
    const { width, height } = this;
    const data = this.#rgba;
    const count = width * height;
    // 배경색: 네 귀퉁이 근처 픽셀의 중앙값
    const samples: number[][] = [[], [], []];
    const corners = [0, width - 1, (height - 1) * width, count - 1];
    for (const corner of corners)
      for (let d = 0; d < 6; d++) {
        const i = Math.min(count - 1, corner + d) * 4;
        samples[0].push(data[i]);
        samples[1].push(data[i + 1]);
        samples[2].push(data[i + 2]);
      }
    const median = (list: number[]) => list.sort((a, b) => a - b)[list.length >> 1];
    const bg = [median(samples[0]), median(samples[1]), median(samples[2])];
    const tolerance = 7;
    const isBackground = (i: number) => {
      const o = i * 4;
      if (data[o + 3] < 128) return true;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      return (
        Math.abs(r - bg[0]) <= tolerance &&
        Math.abs(g - bg[1]) <= tolerance &&
        Math.abs(b - bg[2]) <= tolerance &&
        Math.max(r, g, b) - Math.min(r, g, b) <= 8
      );
    };
    const visited = new Uint8Array(count);
    const stack = new Int32Array(count);
    let top = 0;
    const push = (i: number) => {
      if (!visited[i] && isBackground(i)) {
        visited[i] = 1;
        stack[top++] = i;
      }
    };
    for (let x = 0; x < width; x++) {
      push(x);
      push((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      push(y * width);
      push(y * width + width - 1);
    }
    while (top) {
      const i = stack[--top];
      const x = i % width;
      if (x > 0) push(i - 1);
      if (x < width - 1) push(i + 1);
      if (i >= width) push(i - width);
      if (i < count - width) push(i + width);
    }
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      if (visited[i]) {
        data[o] = data[o + 1] = data[o + 2] = 255;
        this.#alpha[i] = 0;
      } else {
        // 원본에 투명도가 있었으면 흰색 위에 얹어 불투명하게 만듭니다.
        const a = data[o + 3] / 255;
        if (a < 1) {
          data[o] = Math.round(data[o] * a + 255 * (1 - a));
          data[o + 1] = Math.round(data[o + 1] * a + 255 * (1 - a));
          data[o + 2] = Math.round(data[o + 2] * a + 255 * (1 - a));
        }
        this.#alpha[i] = 255;
      }
      data[o + 3] = 255;
      const [h, s, l] = rgbToHsl(data[o] / 255, data[o + 1] / 255, data[o + 2] / 255);
      this.#hsl[i * 3] = h;
      this.#hsl[i * 3 + 1] = s;
      this.#hsl[i * 3 + 2] = l;
    }
  }

  #measureBounds(): Box {
    const { width, height } = this;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (this.#alpha[y * width + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    if (maxX < 0) return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    return {
      x: minX / width,
      y: minY / height,
      w: (maxX - minX + 1) / width,
      h: (maxY - minY + 1) / height
    };
  }

  /** 바닥 그림자: 아래쪽 10% 에 있는 회색 픽셀 */
  #isShadow(i: number) {
    const y = Math.floor(i / this.width);
    return y > this.height * 0.88 && this.#hsl[i * 3 + 1] < 0.08;
  }

  /** 주된 털의 명도·색조·채도. 재채색과 눈·코 보호의 기준입니다. */
  #measureFur() {
    let n = 0;
    let l = 0;
    let s = 0;
    const hueBins = new Float32Array(36);
    for (let i = 0; i < this.#alpha.length; i++) {
      if (!this.#alpha[i] || this.#isShadow(i)) continue;
      const ps = this.#hsl[i * 3 + 1];
      const pl = this.#hsl[i * 3 + 2];
      n++;
      l += pl;
      s += ps;
      if (ps > 0.15 && pl > 0.12 && pl < 0.95)
        hueBins[Math.floor(this.#hsl[i * 3] * 36) % 36] += ps;
    }
    let best = 0;
    for (let b = 1; b < 36; b++) if (hueBins[b] > hueBins[best]) best = b;
    return { l: n ? l / n : 0.6, s: n ? s / n : 0.2, h: (best + 0.5) / 36 };
  }

  #weighFur(stats: { l: number; s: number; h: number }) {
    const { width } = this;
    const insideEllipse = (box: Box | null, x: number, y: number) => {
      if (!box) return false;
      const u = (x / width - box.x - box.w / 2) / (box.w * 0.6);
      const v = (y / this.height - box.y - box.h / 2) / (box.h * 0.6);
      return u * u + v * v < 1;
    };
    const features = [this.layout.eyeLeft, this.layout.eyeRight, this.layout.nose];
    const darkDog = stats.l < 0.4;
    const neutralCoat = stats.s < 0.15;
    for (let i = 0; i < this.#alpha.length; i++) {
      if (!this.#alpha[i] || this.#isShadow(i)) continue;
      const h = this.#hsl[i * 3];
      const s = this.#hsl[i * 3 + 1];
      const l = this.#hsl[i * 3 + 2];
      const x = i % width;
      const y = (i - x) / width;
      let w = 1;
      // 눈·코·입: 밝은 강아지면 아주 어두운 픽셀 전부, 어두운 강아지면 눈·코 자리만
      if (!darkDog && l < 0.22) w = 0;
      else if (darkDog && l < 0.3 && features.some((box) => insideEllipse(box, x, y))) w = 0;
      // 흰 강아지의 분홍 귀 속처럼, 무채색 털에 얹힌 진한 색 포인트는 그대로
      else if (neutralCoat && s > 0.3) w = 0;
      else if (!neutralCoat) {
        // 색깔 털: 주된 색조에서 멀어질수록 덜 칠해서 흰 가슴·눈썹 무늬를 남깁니다
        const d = hueDistance(h, stats.h) * 360;
        w = clamp01(1 - (d - 25) / 30);
        if (s < 0.12 && l > 0.7) w = 0;
      }
      this.#furWeight[i] = w;
    }
  }

  /** 프리셋 색으로 옮긴 픽셀 배열. 원래 색이면 원본 그대로. */
  #recolored(key: FurColorKey): Uint8ClampedArray {
    if (key === this.originalColor) return this.#rgba;
    const cached = this.#recolorCache.get(key);
    if (cached) return cached;
    const preset = furColors.find((color) => color.key === key) ?? furColors[1];
    const [th, ts, tl] = hexToHsl(preset.hex);
    // 명암은 남기되 아주 밝거나 어두운 목표색에서는 폭을 줄여 하이라이트가 날아가지 않게
    const contrast = tl > 0.85 ? 0.45 : tl < 0.25 ? 0.5 : 0.75;
    const out = new Uint8ClampedArray(this.#rgba);
    for (let i = 0; i < this.#alpha.length; i++) {
      const w = this.#furWeight[i];
      if (w <= 0) continue;
      const l = this.#hsl[i * 3 + 2];
      const nl = clamp01(tl + (l - this.#lRef) * contrast);
      const ns = clamp01(ts * (nl > 0.85 ? 1 - (nl - 0.85) * 2.5 : 1));
      const [r, g, b] = hslToRgb(th, ns, nl);
      const o = i * 4;
      out[o] = Math.round(out[o] * (1 - w) + r * 255 * w);
      out[o + 1] = Math.round(out[o + 1] * (1 - w) + g * 255 * w);
      out[o + 2] = Math.round(out[o + 2] * (1 - w) + b * 255 * w);
    }
    this.#recolorCache.set(key, out);
    return out;
  }

  /** 슬라이더 값을 워프 장 목록으로. 작은 부위 → 큰 부위 순서(안쪽부터 바깥쪽)입니다. */
  #fields(params: CharacterParams): Field[] {
    const { width: W, height: H, layout } = this;
    const fields: Field[] = [];
    const center = (box: Box) => ({ cx: (box.x + box.w / 2) * W, cy: (box.y + box.h / 2) * H });
    const near = (a: number, b: number) => Math.abs(a - b) > 0.004;
    const add = (field: Field) => {
      if (
        near(field.kx, 1) ||
        near(field.ky, 1) ||
        Math.abs(field.dx) > 0.5 ||
        Math.abs(field.dy) > 0.5
      )
        fields.push(field);
    };

    // 눈: 크기·모양은 눈 가운데를 중심으로, 간격은 두 눈의 중간점에서 바깥쪽으로 밀어냅니다.
    const shape = eyeShapes.find((entry) => entry.key === params.eyeShape) ?? eyeShapes[0];
    const eyes = [layout.eyeLeft, layout.eyeRight].filter((box): box is Box => Boolean(box));
    const eyeMid = eyes.length
      ? eyes.reduce((sum, box) => sum + center(box).cx, 0) / eyes.length
      : 0;
    for (const box of eyes) {
      const { cx, cy } = center(box);
      const radius = Math.max(box.w * W, box.h * H) * 1.7;
      const dx = eyes.length > 1 ? (cx - eyeMid) * (params.eyeGap - 1) : 0;
      add({
        cx,
        cy,
        rx: radius,
        ry: radius,
        kx: params.eyeSize * shape.sx,
        ky: params.eyeSize * shape.sy,
        dx,
        dy: 0,
        plateau: 0.45
      });
    }

    // 얼굴(주둥이 둘레): 코가 있으면 코와 눈 사이, 없으면 머리 아래쪽 가운데
    {
      const head = layout.head;
      const nose = layout.nose ? center(layout.nose) : null;
      const cx = nose ? nose.cx - head.w * W * 0.12 : (head.x + head.w * 0.62) * W;
      const cy = nose ? nose.cy - head.h * H * 0.05 : (head.y + head.h * 0.62) * H;
      add({
        cx,
        cy,
        rx: head.w * W * 0.42,
        ry: head.h * H * 0.4,
        kx: params.faceSize,
        ky: params.faceSize,
        dx: 0,
        dy: 0,
        plateau: 0.4
      });
    }

    // 귀: 붙은 쪽을 고정점으로 두고 바깥으로 자라게
    for (const box of [layout.earLeft, layout.earRight]) {
      if (!box) continue;
      const { cx } = center(box);
      const cy =
        this.#earAnchor === 'top'
          ? (box.y + box.h * 0.12) * H
          : this.#earAnchor === 'bottom'
            ? (box.y + box.h * 0.88) * H
            : (box.y + box.h / 2) * H;
      const ry = this.#earAnchor === 'center' ? box.h * H * 0.8 : box.h * H * 1.25;
      add({
        cx,
        cy,
        rx: box.w * W * 0.85,
        ry,
        kx: params.earSize,
        ky: params.earSize * params.earLength,
        dx: 0,
        dy: 0,
        plateau: 0.55
      });
    }

    // 머리: 귀·눈까지 함께 커지도록 넉넉한 반지름
    {
      const { cx, cy } = center(layout.head);
      add({
        cx,
        cy,
        rx: layout.head.w * W * 0.72,
        ry: layout.head.h * H * 0.72,
        kx: params.headSize,
        ky: params.headSize,
        dx: 0,
        dy: 0,
        plateau: 0.6
      });
    }

    // 꼬리
    if (layout.tail) {
      const { cx, cy } = center(layout.tail);
      add({
        cx,
        cy,
        rx: layout.tail.w * W * 0.8,
        ry: layout.tail.h * H * 0.8,
        kx: params.tailSize,
        ky: params.tailSize,
        dx: 0,
        dy: 0,
        plateau: 0.5
      });
    }

    // 몸: 몸통 비율은 가로로만 늘립니다
    {
      const body = layout.body;
      const cx = (body.x + body.w / 2) * W;
      const cy = (body.y + body.h * 0.55) * H;
      add({
        cx,
        cy,
        rx: body.w * W * 0.66,
        ry: body.h * H * 0.62,
        kx: params.bodySize * params.bodyLength,
        ky: params.bodySize,
        dx: 0,
        dy: 0,
        plateau: 0.5
      });
    }
    return fields;
  }

  /**
   * 워프한 그림을 size × size(비율 유지) ImageData 로. 목적지 픽셀마다 원본 좌표를
   * 거꾸로 찾아(바깥 장부터 안쪽 장 순서) 쌍선형 보간으로 색을 가져옵니다.
   */
  #warp(source: Uint8ClampedArray, params: CharacterParams, size: number): ImageData {
    const { width: W, height: H } = this;
    const scale = size / Math.max(W, H);
    const outW = Math.max(1, Math.round(W * scale));
    const outH = Math.max(1, Math.round(H * scale));
    const out = new ImageData(outW, outH);
    const data = out.data;
    const alpha = this.#alpha;
    const fields = this.#fields(params).reverse();
    const inv = 1 / scale;
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        let sx = (x + 0.5) * inv;
        let sy = (y + 0.5) * inv;
        for (const f of fields) {
          const cx = f.cx + f.dx;
          const cy = f.cy + f.dy;
          const u = (sx - cx) / f.rx;
          const v = (sy - cy) / f.ry;
          const r2 = u * u + v * v;
          if (r2 >= 1) continue;
          const r = Math.sqrt(r2);
          const t = r <= f.plateau ? 1 : smoothstep((1 - r) / (1 - f.plateau));
          const kx = 1 + (f.kx - 1) * t;
          const ky = 1 + (f.ky - 1) * t;
          sx = cx + (sx - cx) / kx - f.dx * t;
          sy = cy + (sy - cy) / ky - f.dy * t;
        }
        // 쌍선형 보간 (원본 밖은 투명)
        const fx = sx - 0.5;
        const fy = sy - 0.5;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let j = 0; j < 2; j++) {
          const yy = y0 + j;
          if (yy < 0 || yy >= H) continue;
          const wy = j ? ty : 1 - ty;
          for (let i = 0; i < 2; i++) {
            const xx = x0 + i;
            if (xx < 0 || xx >= W) continue;
            const w = wy * (i ? tx : 1 - tx);
            const idx = yy * W + xx;
            const o = idx * 4;
            r += source[o] * w;
            g += source[o + 1] * w;
            b += source[o + 2] * w;
            a += alpha[idx] * w;
          }
        }
        const o = (y * outW + x) * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = a;
      }
    }
    return out;
  }

  /** target 캔버스에 지금 값으로 그립니다. size 는 긴 변의 픽셀 수. */
  render(target: HTMLCanvasElement, params: CharacterParams, size = 448) {
    const image = this.#warp(this.#recolored(params.furColor), params, size);
    if (target.width !== image.width || target.height !== image.height) {
      target.width = image.width;
      target.height = image.height;
    }
    target.getContext('2d')?.putImageData(image, 0, 0);
  }

  /** 저장용 최종 그림. 투명 배경 WebP(지원하지 않는 브라우저는 PNG). */
  export(params: CharacterParams, size = 640, quality = 0.9): string {
    const canvas = document.createElement('canvas');
    this.render(canvas, params, size);
    const webp = canvas.toDataURL('image/webp', quality);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  }
}
