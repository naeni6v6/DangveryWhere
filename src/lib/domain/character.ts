/**
 * 내 강아지 캐릭터 — 사진 한 장으로 댕브리웨어 세계관 캐릭터를 만드는 기능의 공용 타입.
 *
 * 캐릭터는 "AI 가 만든 기본 그림 + 부위 위치 + 사용자가 조절한 값" 세 가지로 이뤄집니다.
 * 슬라이더는 브라우저 캔버스에서 바로 반영되고(src/lib/character/renderer.ts),
 * 표정처럼 그림 자체를 다시 그려야 하는 것만 AI 를 다시 부릅니다.
 * 이 파일은 서버·브라우저·테스트가 함께 쓰므로 DOM 을 건드리지 않습니다.
 */

/** 털 색상 프리셋. 자유 색상 대신 캐릭터 톤에 맞는 여섯 가지만 둡니다. */
export type FurColorKey = 'white' | 'cream' | 'beige' | 'brown' | 'black' | 'gray';
export const furColors: { key: FurColorKey; label: string; hex: string }[] = [
  { key: 'white', label: '화이트', hex: '#f5f0e6' },
  { key: 'cream', label: '크림', hex: '#f0e0c2' },
  { key: 'beige', label: '베이지', hex: '#e0bf94' },
  { key: 'brown', label: '브라운', hex: '#b07648' },
  { key: 'black', label: '블랙', hex: '#3a3230' },
  { key: 'gray', label: '그레이', hex: '#8f8b89' }
];
export const furColorKeys = furColors.map((color) => color.key);

/** 눈 모양 프리셋 — 캐릭터 스타일(작은 구슬 눈)을 깨지 않는 범위에서만 둡니다. */
export type EyeShape = 'basic' | 'round' | 'big';
export const eyeShapes: { key: EyeShape; label: string; sx: number; sy: number }[] = [
  { key: 'basic', label: '기본', sx: 1, sy: 1 },
  { key: 'round', label: '동그란 눈', sx: 1.08, sy: 1.16 },
  { key: 'big', label: '살짝 큰 눈', sx: 1.18, sy: 1.18 }
];

/** 표정은 그림을 다시 그려야 해서 [AI 로 다시 생성] 할 때만 반영됩니다. */
export type Expression = 'smile' | 'happy' | 'sleepy' | 'curious';
export const expressions: { key: Expression; label: string; prompt: string }[] = [
  {
    key: 'smile',
    label: '기본 미소',
    prompt: 'a gentle closed-mouth smile (the default expression)'
  },
  {
    key: 'happy',
    label: '신나요',
    prompt: 'a happy open-mouth smile with a small tongue peeking out'
  },
  {
    key: 'sleepy',
    label: '졸려요',
    prompt: 'sleepy, relaxed half-closed eyes and a soft content smile'
  },
  {
    key: 'curious',
    label: '궁금해요',
    prompt: 'a curious look with the head tilted slightly and eyes wide'
  }
];

/** 실시간으로 조절되는 값. 모두 1 이 "AI 가 만든 그대로" 입니다. */
export type CharacterParams = {
  eyeSize: number;
  eyeGap: number;
  eyeShape: EyeShape;
  faceSize: number;
  headSize: number;
  bodySize: number;
  bodyLength: number;
  earSize: number;
  earLength: number;
  tailSize: number;
  scale: number;
  furColor: FurColorKey;
};
export type SliderKey = Exclude<keyof CharacterParams, 'eyeShape' | 'furColor'>;

/**
 * 슬라이더 목록과 허용 범위.
 * 값을 아무리 움직여도 "다른 강아지"가 되지 않도록 범위를 좁게 잡았습니다.
 */
export const sliders: {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  group: '얼굴' | '몸';
}[] = [
  { key: 'eyeSize', label: '눈 크기', min: 0.8, max: 1.5, step: 0.01, group: '얼굴' },
  { key: 'eyeGap', label: '눈 간격', min: 0.85, max: 1.2, step: 0.01, group: '얼굴' },
  { key: 'faceSize', label: '얼굴 크기', min: 0.9, max: 1.2, step: 0.01, group: '얼굴' },
  { key: 'headSize', label: '머리 크기', min: 0.9, max: 1.25, step: 0.01, group: '얼굴' },
  { key: 'earSize', label: '귀 크기', min: 0.8, max: 1.4, step: 0.01, group: '얼굴' },
  { key: 'earLength', label: '귀 길이', min: 0.9, max: 1.4, step: 0.01, group: '얼굴' },
  { key: 'bodySize', label: '몸 크기', min: 0.85, max: 1.2, step: 0.01, group: '몸' },
  { key: 'bodyLength', label: '몸통 비율', min: 0.9, max: 1.2, step: 0.01, group: '몸' },
  { key: 'tailSize', label: '꼬리 크기', min: 0.7, max: 1.5, step: 0.01, group: '몸' },
  { key: 'scale', label: '전체 크기', min: 0.8, max: 1.2, step: 0.01, group: '몸' }
];

export const DEFAULT_PARAMS: CharacterParams = {
  eyeSize: 1,
  eyeGap: 1,
  eyeShape: 'basic',
  faceSize: 1,
  headSize: 1,
  bodySize: 1,
  bodyLength: 1,
  earSize: 1,
  earLength: 1,
  tailSize: 1,
  scale: 1,
  furColor: 'cream'
};

/** 이미지 안 위치. 0~1 로 정규화한 왼쪽 위 좌표와 폭·높이. */
export type Box = { x: number; y: number; w: number; h: number };
/**
 * AI 가 만든 그림에서 부위가 어디 있는지. 캔버스 워프의 기준점이 됩니다.
 * 옆모습이라 귀·눈 한쪽이 안 보일 수 있어 머리·몸 말고는 없을 수 있어요.
 */
export type CharacterLayout = {
  head: Box;
  body: Box;
  eyeLeft: Box | null;
  eyeRight: Box | null;
  nose: Box | null;
  earLeft: Box | null;
  earRight: Box | null;
  tail: Box | null;
};

/** AI 가 사진에서 읽어 낸 강아지의 특징. 프롬프트와 초기 커스터마이징 값의 근거입니다. */
export type DogTraits = {
  /** 한글 견종 추정 (예: 푸들, 믹스) */
  breedGuess: string;
  /** breeds.ts 의 key 와 맞는 것이 있으면 (예: poodle) */
  breedKey: string | null;
  coatColor: FurColorKey;
  coatHex: string;
  coatPattern: 'solid' | 'bicolor' | 'tricolor' | 'brindle' | 'spotted' | 'merle';
  /** 영어 한 줄 — 무늬가 어디에 어떻게 있는지 */
  markings: string;
  furTexture: 'smooth' | 'fluffy' | 'curly' | 'wiry' | 'long';
  earType: 'floppy' | 'upright' | 'semi' | 'button';
  earSize: 'small' | 'medium' | 'large';
  muzzle: 'short' | 'medium' | 'long';
  faceShape: 'round' | 'oval' | 'long';
  eyeColor: string;
  noseColor: 'black' | 'brown' | 'pink';
  bodyType: 'small' | 'medium' | 'large';
  tail: 'curled' | 'straight' | 'fluffy' | 'short' | 'docked';
  /** 영어 구절 — 그 아이만의 눈에 띄는 점 */
  distinctive: string[];
  /** 화면에 보여 줄 한국어 한 줄 요약 */
  summaryKo: string;
};

/** 저장되는 캐릭터 한 마리. */
export type DogCharacter = {
  id: string;
  /** 어느 강아지의 캐릭터인지. 강아지를 지우면 비워집니다. */
  dogId: string | null;
  /** 업로드한 원본 사진 (줄인 JPEG data URL). 목록만 불러올 때는 비어 있을 수 있어요. */
  sourceImage?: string;
  /** AI 가 만든 기본 그림 (data URL) */
  characterImage?: string;
  /** 커스터마이징을 반영한 최종 그림 (투명 배경 WebP data URL) */
  finalImage: string;
  traits: DogTraits;
  layout: CharacterLayout;
  params: CharacterParams;
  expression: Expression;
  createdAt: string;
  updatedAt: string;
};

/** 한글 라벨 — 분석 결과를 사람이 읽기 좋게 */
export const traitLabels = {
  coatPattern: {
    solid: '단색',
    bicolor: '두 가지 색',
    tricolor: '세 가지 색',
    brindle: '얼룩무늬',
    spotted: '점무늬',
    merle: '멀 무늬'
  },
  furTexture: {
    smooth: '짧고 매끈한 털',
    fluffy: '복슬복슬한 털',
    curly: '곱슬 털',
    wiry: '거친 털',
    long: '긴 털'
  },
  earType: { floppy: '늘어진 귀', upright: '쫑긋한 귀', semi: '반쯤 접힌 귀', button: '접힌 귀' },
  muzzle: { short: '짧은 주둥이', medium: '보통 주둥이', long: '긴 주둥이' },
  tail: {
    curled: '말린 꼬리',
    straight: '곧은 꼬리',
    fluffy: '복슬 꼬리',
    short: '짧은 꼬리',
    docked: '아주 짧은 꼬리'
  }
} as const;

export function furColorLabel(key: FurColorKey) {
  return furColors.find((color) => color.key === key)?.label ?? key;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 범위를 벗어난 값은 범위 안으로 끌어오고, 형식이 아예 틀리면 기본값으로 둡니다. */
export function normalizeParams(value: unknown): CharacterParams {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const result: CharacterParams = { ...DEFAULT_PARAMS };
  for (const slider of sliders) {
    const raw = item[slider.key];
    result[slider.key] = isNumber(raw) ? clamp(raw, slider.min, slider.max) : 1;
  }
  if (eyeShapes.some((shape) => shape.key === item.eyeShape))
    result.eyeShape = item.eyeShape as EyeShape;
  if (furColorKeys.includes(item.furColor as FurColorKey))
    result.furColor = item.furColor as FurColorKey;
  return result;
}

function normalizeBox(value: unknown): Box | null {
  if (!value || typeof value !== 'object') return null;
  const box = value as Record<string, unknown>;
  if (![box.x, box.y, box.w, box.h].every(isNumber)) return null;
  const x = clamp(box.x as number, 0, 1);
  const y = clamp(box.y as number, 0, 1);
  const w = clamp(box.w as number, 0, 1 - x);
  const h = clamp(box.h as number, 0, 1 - y);
  if (w < 0.005 || h < 0.005) return null;
  return { x, y, w, h };
}

/** 머리와 몸이 있어야 워프를 걸 수 있어요. 나머지는 없어도 됩니다. */
export function validateLayout(value: unknown): CharacterLayout | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const head = normalizeBox(item.head);
  const body = normalizeBox(item.body);
  if (!head || !body) return null;
  return {
    head,
    body,
    eyeLeft: normalizeBox(item.eyeLeft),
    eyeRight: normalizeBox(item.eyeRight),
    nose: normalizeBox(item.nose),
    earLeft: normalizeBox(item.earLeft),
    earRight: normalizeBox(item.earRight),
    tail: normalizeBox(item.tail)
  };
}

/**
 * 부위 탐지가 실패했을 때 쓰는 기본 위치.
 * 우리 캐릭터는 늘 오른쪽을 보는 4분의 3 측면이라, 강아지가 차지하는 영역만 알면
 * 머리는 오른쪽 위, 몸은 왼쪽 아래에 있다고 볼 수 있습니다.
 */
export function layoutFromBounds(bounds: Box): CharacterLayout {
  const at = (x: number, y: number, w: number, h: number): Box => ({
    x: bounds.x + bounds.w * x,
    y: bounds.y + bounds.h * y,
    w: bounds.w * w,
    h: bounds.h * h
  });
  return {
    head: at(0.36, 0.02, 0.62, 0.5),
    body: at(0.02, 0.42, 0.72, 0.56),
    eyeLeft: at(0.62, 0.26, 0.08, 0.08),
    eyeRight: at(0.84, 0.25, 0.06, 0.07),
    nose: at(0.86, 0.36, 0.1, 0.09),
    earLeft: at(0.36, 0.06, 0.26, 0.34),
    earRight: at(0.8, 0.02, 0.18, 0.3),
    tail: at(0, 0.3, 0.24, 0.28)
  };
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const text = (value: unknown, max: number, fallback = '') =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

/** AI 가 돌려준 특징을 우리가 아는 값으로만 좁힙니다. 이상한 값은 무난한 기본값으로. */
export function normalizeTraits(value: unknown): DogTraits {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const distinctive = Array.isArray(item.distinctive)
    ? item.distinctive.filter((entry): entry is string => typeof entry === 'string').slice(0, 6)
    : [];
  return {
    breedGuess: text(item.breedGuess, 40, '믹스'),
    breedKey:
      typeof item.breedKey === 'string' && item.breedKey ? item.breedKey.slice(0, 40) : null,
    coatColor: pick(item.coatColor, furColorKeys, 'cream'),
    coatHex: /^#[0-9a-f]{6}$/i.test(String(item.coatHex))
      ? String(item.coatHex).toLowerCase()
      : '#e0bf94',
    coatPattern: pick(
      item.coatPattern,
      ['solid', 'bicolor', 'tricolor', 'brindle', 'spotted', 'merle'] as const,
      'solid'
    ),
    markings: text(item.markings, 200),
    furTexture: pick(
      item.furTexture,
      ['smooth', 'fluffy', 'curly', 'wiry', 'long'] as const,
      'smooth'
    ),
    earType: pick(item.earType, ['floppy', 'upright', 'semi', 'button'] as const, 'floppy'),
    earSize: pick(item.earSize, ['small', 'medium', 'large'] as const, 'medium'),
    muzzle: pick(item.muzzle, ['short', 'medium', 'long'] as const, 'medium'),
    faceShape: pick(item.faceShape, ['round', 'oval', 'long'] as const, 'round'),
    eyeColor: text(item.eyeColor, 30, 'dark brown'),
    noseColor: pick(item.noseColor, ['black', 'brown', 'pink'] as const, 'black'),
    bodyType: pick(item.bodyType, ['small', 'medium', 'large'] as const, 'small'),
    tail: pick(item.tail, ['curled', 'straight', 'fluffy', 'short', 'docked'] as const, 'straight'),
    distinctive: distinctive.map((entry) => entry.slice(0, 80)),
    summaryKo: text(item.summaryKo, 120)
  };
}

/** 프롬프트에 넣을 영어 특징 설명. 사진의 아이를 알아볼 수 있게 하는 핵심 근거입니다. */
export function describeTraits(traits: DogTraits): string {
  const lines = [
    `breed: ${traits.breedGuess}${traits.breedKey ? ` (${traits.breedKey})` : ''}`,
    `main coat color: ${traits.coatColor} (${traits.coatHex}), pattern: ${traits.coatPattern}`,
    traits.markings ? `markings: ${traits.markings}` : '',
    `fur: ${traits.furTexture}`,
    `ears: ${traits.earType}, ${traits.earSize}`,
    `muzzle: ${traits.muzzle}, face: ${traits.faceShape}`,
    `eyes: ${traits.eyeColor}, nose: ${traits.noseColor}`,
    `body: ${traits.bodyType}, tail: ${traits.tail}`,
    traits.distinctive.length ? `distinctive: ${traits.distinctive.join('; ')}` : ''
  ];
  return lines.filter(Boolean).join('\n');
}

const isDataImage = (value: unknown, maxLength: number) =>
  typeof value === 'string' &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) &&
  value.length <= maxLength;

/** data URL 하나가 차지하는 최대 길이 (base64). 사진 1024px JPEG 와 그림 1024px 를 넉넉히 담습니다. */
export const MAX_IMAGE_DATA_LENGTH = 2_800_000;

/**
 * 저장하려는 캐릭터를 확인합니다. 그림이 없거나 형식이 틀리면 null.
 * id 는 서버(DB)나 브라우저가 붙이므로 여기서는 보지 않습니다.
 */
export function validateCharacterInput(
  value: unknown
): Omit<DogCharacter, 'id' | 'createdAt' | 'updatedAt'> | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const layout = validateLayout(item.layout);
  if (!layout) return null;
  if (!isDataImage(item.finalImage, MAX_IMAGE_DATA_LENGTH)) return null;
  const sourceImage = isDataImage(item.sourceImage, MAX_IMAGE_DATA_LENGTH)
    ? (item.sourceImage as string)
    : undefined;
  const characterImage = isDataImage(item.characterImage, MAX_IMAGE_DATA_LENGTH)
    ? (item.characterImage as string)
    : undefined;
  const dogId =
    typeof item.dogId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.dogId)
      ? item.dogId
      : null;
  return {
    dogId,
    sourceImage,
    characterImage,
    finalImage: item.finalImage as string,
    traits: normalizeTraits(item.traits),
    layout,
    params: normalizeParams(item.params),
    expression: pick(
      item.expression,
      expressions.map((entry) => entry.key),
      'smile'
    )
  };
}
