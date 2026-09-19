/**
 * 견종 캐릭터의 밑그림.
 *
 * 견종마다 '이 아이는 대체로 이런 털·귀·꼬리' 라는 기본 특징(breedSketches)과,
 * static/dogs/<key>.webp 그림에서 손으로 잰 부위 위치(breedLayouts)를 모아 둡니다.
 * 캐릭터 꾸미기 화면(/web/start/character)이 이 값으로 밑그림을 세우고,
 * 서버의 데모 모드($lib/server/character/mock.ts)도 같은 값을 씁니다.
 * 브라우저와 서버가 함께 읽으므로 이 파일에는 서버 전용 코드를 두지 않습니다.
 */
import { breedImage, findBreed, type Breed } from '$lib/domain/breeds';
import {
  normalizeTraits,
  type CharacterLayout,
  type DogTraits,
  type FurColorKey
} from '$lib/domain/character';

export type BreedSketch = Partial<DogTraits>;
export const breedSketches: Record<string, BreedSketch> = {
  maltese: {
    coatColor: 'white',
    coatHex: '#f3ede2',
    furTexture: 'long',
    earType: 'floppy',
    tail: 'fluffy',
    summaryKo: '새하얀 긴 털에 늘어진 귀가 포근한 아이예요.'
  },
  poodle: {
    coatColor: 'brown',
    coatHex: '#c98a5a',
    furTexture: 'curly',
    earType: 'floppy',
    tail: 'short',
    summaryKo: '갈색 곱슬 털이 폭신한 아이예요.'
  },
  pomeranian: {
    coatColor: 'beige',
    coatHex: '#e1b17a',
    furTexture: 'fluffy',
    earType: 'upright',
    tail: 'curled',
    summaryKo: '풍성한 털에 작은 귀가 쫑긋한 아이예요.'
  },
  'golden-retriever': {
    coatColor: 'beige',
    coatHex: '#dfae74',
    furTexture: 'long',
    earType: 'floppy',
    bodyType: 'large',
    tail: 'fluffy',
    muzzle: 'long',
    summaryKo: '황금빛 털에 순한 얼굴을 가진 아이예요.'
  },
  jindo: {
    coatColor: 'cream',
    coatHex: '#efd9b0',
    furTexture: 'smooth',
    earType: 'upright',
    bodyType: 'medium',
    tail: 'curled',
    muzzle: 'medium',
    summaryKo: '늠름한 쫑긋 귀와 말린 꼬리가 멋진 아이예요.'
  },
  'shih-tzu': {
    coatColor: 'cream',
    coatHex: '#ead9c0',
    coatPattern: 'bicolor',
    markings: 'darker brown patches on ears and back',
    furTexture: 'long',
    earType: 'floppy',
    muzzle: 'short',
    summaryKo: '긴 털에 납작한 코가 귀여운 아이예요.'
  },
  chihuahua: {
    coatColor: 'beige',
    coatHex: '#e2b98a',
    coatPattern: 'bicolor',
    markings: 'cream chest and muzzle',
    furTexture: 'smooth',
    earType: 'upright',
    earSize: 'large',
    tail: 'straight',
    summaryKo: '큰 귀와 또렷한 눈이 인상적인 아이예요.'
  },
  'bichon-frise': {
    coatColor: 'white',
    coatHex: '#f5f1ea',
    furTexture: 'curly',
    earType: 'floppy',
    tail: 'curled',
    summaryKo: '솜사탕 같은 하얀 곱슬 털의 아이예요.'
  },
  'siberian-husky': {
    coatColor: 'gray',
    coatHex: '#6f6a68',
    coatPattern: 'bicolor',
    markings: 'cream face mask, chest and legs',
    furTexture: 'fluffy',
    earType: 'upright',
    bodyType: 'large',
    tail: 'curled',
    muzzle: 'long',
    summaryKo: '회색 털에 하얀 얼굴 무늬가 멋진 아이예요.'
  },
  'welsh-corgi': {
    coatColor: 'beige',
    coatHex: '#e19d5c',
    coatPattern: 'bicolor',
    markings: 'white blaze, chest, belly and paws',
    furTexture: 'smooth',
    earType: 'upright',
    earSize: 'large',
    bodyType: 'medium',
    tail: 'short',
    summaryKo: '큰 귀와 짧은 다리가 사랑스러운 아이예요.'
  },
  beagle: {
    coatColor: 'brown',
    coatHex: '#c68d5c',
    coatPattern: 'tricolor',
    markings: 'black saddle, white muzzle, chest and paws',
    furTexture: 'smooth',
    earType: 'floppy',
    earSize: 'large',
    bodyType: 'medium',
    tail: 'straight',
    summaryKo: '세 가지 색 털에 긴 귀가 늘어진 아이예요.'
  },
  greyhound: {
    coatColor: 'gray',
    coatHex: '#9a9592',
    furTexture: 'smooth',
    earType: 'semi',
    bodyType: 'large',
    faceShape: 'long',
    muzzle: 'long',
    tail: 'straight',
    summaryKo: '늘씬한 몸과 긴 얼굴이 우아한 아이예요.'
  },
  dachshund: {
    coatColor: 'brown',
    coatHex: '#6b3f2a',
    coatPattern: 'bicolor',
    markings: 'tan points on muzzle, brows, chest and paws',
    furTexture: 'smooth',
    earType: 'floppy',
    bodyType: 'small',
    faceShape: 'long',
    muzzle: 'long',
    tail: 'straight',
    summaryKo: '긴 몸통과 짧은 다리가 매력인 아이예요.'
  },
  'french-bulldog': {
    coatColor: 'cream',
    coatHex: '#efe0cf',
    coatPattern: 'bicolor',
    markings: 'dark gray patches over the eyes, ears and back',
    furTexture: 'smooth',
    earType: 'upright',
    earSize: 'large',
    muzzle: 'short',
    tail: 'docked',
    summaryKo: '박쥐 귀와 납작한 얼굴이 개성 있는 아이예요.'
  },
  'miniature-schnauzer': {
    coatColor: 'gray',
    coatHex: '#7d7876',
    coatPattern: 'bicolor',
    markings: 'lighter gray eyebrows, beard and legs',
    furTexture: 'wiry',
    earType: 'button',
    tail: 'short',
    summaryKo: '수염과 눈썹이 멋진 아이예요.'
  },
  'labrador-retriever': {
    coatColor: 'cream',
    coatHex: '#efd9b3',
    furTexture: 'smooth',
    earType: 'button',
    bodyType: 'large',
    muzzle: 'long',
    tail: 'straight',
    summaryKo: '든든한 몸집에 순한 눈을 가진 아이예요.'
  },
  'shiba-inu': {
    coatColor: 'beige',
    coatHex: '#e59d5a',
    coatPattern: 'bicolor',
    markings: 'cream cheeks, chest, belly and legs',
    furTexture: 'smooth',
    earType: 'upright',
    bodyType: 'medium',
    tail: 'curled',
    summaryKo: '여우 같은 얼굴과 말린 꼬리의 아이예요.'
  },
  papillon: {
    coatColor: 'white',
    coatHex: '#f4efe6',
    coatPattern: 'bicolor',
    markings: 'brown patches on the ears and around the eyes',
    furTexture: 'long',
    earType: 'upright',
    earSize: 'large',
    tail: 'fluffy',
    summaryKo: '나비 같은 큰 귀가 눈에 띄는 아이예요.'
  }
};

/** 기존 캐릭터 그림에서 손으로 잰 부위 위치 (1024px 기준을 0~1 로). 없는 견종은 자동 추정. */
export const breedLayouts: Record<string, CharacterLayout> = {
  maltese: {
    head: { x: 0.29, y: 0.13, w: 0.56, h: 0.38 },
    body: { x: 0.15, y: 0.47, w: 0.55, h: 0.41 },
    eyeLeft: { x: 0.6, y: 0.34, w: 0.05, h: 0.05 },
    eyeRight: { x: 0.75, y: 0.325, w: 0.04, h: 0.045 },
    nose: { x: 0.72, y: 0.375, w: 0.06, h: 0.055 },
    earLeft: { x: 0.29, y: 0.17, w: 0.25, h: 0.29 },
    earRight: { x: 0.76, y: 0.15, w: 0.1, h: 0.3 },
    tail: { x: 0.15, y: 0.37, w: 0.21, h: 0.24 }
  },
  poodle: {
    head: { x: 0.37, y: 0.13, w: 0.48, h: 0.4 },
    body: { x: 0.22, y: 0.5, w: 0.5, h: 0.4 },
    eyeLeft: { x: 0.635, y: 0.356, w: 0.04, h: 0.04 },
    eyeRight: { x: 0.742, y: 0.347, w: 0.04, h: 0.04 },
    nose: { x: 0.73, y: 0.38, w: 0.06, h: 0.05 },
    earLeft: { x: 0.38, y: 0.29, w: 0.17, h: 0.24 },
    earRight: { x: 0.8, y: 0.31, w: 0.05, h: 0.2 },
    tail: { x: 0.22, y: 0.41, w: 0.13, h: 0.13 }
  },
  'shiba-inu': {
    head: { x: 0.44, y: 0.16, w: 0.36, h: 0.33 },
    body: { x: 0.2, y: 0.46, w: 0.56, h: 0.42 },
    eyeLeft: { x: 0.6, y: 0.33, w: 0.045, h: 0.045 },
    eyeRight: { x: 0.727, y: 0.317, w: 0.04, h: 0.04 },
    nose: { x: 0.72, y: 0.36, w: 0.06, h: 0.05 },
    earLeft: { x: 0.44, y: 0.16, w: 0.1, h: 0.15 },
    earRight: { x: 0.65, y: 0.14, w: 0.12, h: 0.16 },
    tail: { x: 0.21, y: 0.31, w: 0.2, h: 0.2 }
  },
  'welsh-corgi': {
    head: { x: 0.49, y: 0.22, w: 0.35, h: 0.29 },
    body: { x: 0.2, y: 0.47, w: 0.55, h: 0.41 },
    eyeLeft: { x: 0.645, y: 0.376, w: 0.04, h: 0.04 },
    eyeRight: { x: 0.767, y: 0.36, w: 0.035, h: 0.035 },
    nose: { x: 0.76, y: 0.395, w: 0.06, h: 0.05 },
    earLeft: { x: 0.42, y: 0.18, w: 0.16, h: 0.2 },
    earRight: { x: 0.68, y: 0.13, w: 0.13, h: 0.2 },
    tail: { x: 0.2, y: 0.46, w: 0.12, h: 0.09 }
  },
  'siberian-husky': {
    head: { x: 0.49, y: 0.14, w: 0.3, h: 0.35 },
    body: { x: 0.2, y: 0.47, w: 0.55, h: 0.41 },
    eyeLeft: { x: 0.645, y: 0.347, w: 0.04, h: 0.04 },
    eyeRight: { x: 0.737, y: 0.337, w: 0.035, h: 0.035 },
    nose: { x: 0.74, y: 0.376, w: 0.05, h: 0.05 },
    earLeft: { x: 0.51, y: 0.15, w: 0.08, h: 0.15 },
    earRight: { x: 0.67, y: 0.14, w: 0.09, h: 0.16 },
    tail: { x: 0.2, y: 0.29, w: 0.23, h: 0.25 }
  },
  dachshund: {
    head: { x: 0.39, y: 0.17, w: 0.49, h: 0.34 },
    body: { x: 0.13, y: 0.48, w: 0.65, h: 0.4 },
    eyeLeft: { x: 0.664, y: 0.293, w: 0.04, h: 0.04 },
    eyeRight: { x: 0.78, y: 0.283, w: 0.04, h: 0.04 },
    nose: { x: 0.81, y: 0.33, w: 0.06, h: 0.05 },
    earLeft: { x: 0.39, y: 0.2, w: 0.22, h: 0.34 },
    earRight: { x: 0.78, y: 0.24, w: 0.1, h: 0.26 },
    tail: { x: 0.12, y: 0.32, w: 0.11, h: 0.19 }
  },
  'french-bulldog': {
    head: { x: 0.37, y: 0.15, w: 0.41, h: 0.4 },
    body: { x: 0.23, y: 0.5, w: 0.5, h: 0.38 },
    eyeLeft: { x: 0.57, y: 0.386, w: 0.04, h: 0.04 },
    eyeRight: { x: 0.718, y: 0.37, w: 0.03, h: 0.03 },
    nose: { x: 0.674, y: 0.4, w: 0.06, h: 0.05 },
    earLeft: { x: 0.37, y: 0.16, w: 0.16, h: 0.23 },
    earRight: { x: 0.6, y: 0.15, w: 0.16, h: 0.18 },
    tail: { x: 0.29, y: 0.47, w: 0.07, h: 0.06 }
  },
  chihuahua: {
    head: { x: 0.43, y: 0.15, w: 0.33, h: 0.36 },
    body: { x: 0.28, y: 0.5, w: 0.47, h: 0.4 },
    eyeLeft: { x: 0.56, y: 0.376, w: 0.04, h: 0.04 },
    eyeRight: { x: 0.688, y: 0.36, w: 0.035, h: 0.035 },
    nose: { x: 0.68, y: 0.39, w: 0.05, h: 0.045 },
    earLeft: { x: 0.32, y: 0.18, w: 0.17, h: 0.21 },
    earRight: { x: 0.6, y: 0.14, w: 0.16, h: 0.19 },
    tail: { x: 0.26, y: 0.43, w: 0.07, h: 0.16 }
  },
  'golden-retriever': {
    head: { x: 0.39, y: 0.14, w: 0.39, h: 0.31 },
    body: { x: 0.24, y: 0.42, w: 0.5, h: 0.46 },
    eyeLeft: { x: 0.595, y: 0.25, w: 0.04, h: 0.04 },
    eyeRight: { x: 0.698, y: 0.24, w: 0.035, h: 0.035 },
    nose: { x: 0.7, y: 0.278, w: 0.055, h: 0.05 },
    earLeft: { x: 0.37, y: 0.18, w: 0.18, h: 0.26 },
    earRight: { x: 0.72, y: 0.2, w: 0.06, h: 0.2 },
    tail: { x: 0.21, y: 0.4, w: 0.16, h: 0.22 }
  }
};

/** 견종 이름·key 로 캐릭터 그림이 있는 견종을 찾습니다. 못 찾으면 말티즈로 둡니다. */
export function breedCharacterKey(...hints: (string | null | undefined)[]): string {
  for (const hint of hints) {
    const found = findBreed(hint ?? '');
    if (found) return found.key;
  }
  return 'maltese';
}

/** 그 견종의 기본 특징. 사진 없이 꾸미기를 시작할 때의 출발점입니다. */
export function breedCharacterTraits(key: string, note = ''): DogTraits {
  const breed = findBreed(key);
  return normalizeTraits({
    breedGuess: breed?.label ?? '믹스',
    breedKey: key,
    distinctive: note ? [note] : [],
    ...(breedSketches[key] ?? {})
  });
}

/** 꾸미기 화면이 바로 쓸 수 있는 밑그림 한 벌 (그림 주소·부위 위치·그림 본래의 털 색). */
export function breedCharacterBase(breed: Breed | undefined, fallbackBreedName?: string | null) {
  const key = breedCharacterKey(breed?.key, breed?.label, fallbackBreedName);
  const found = findBreed(key)!;
  return {
    key,
    breed: found,
    image: breedImage(found),
    layout: breedLayouts[key] ?? null,
    /** 그림 자체의 털 색. 이 프리셋을 고르면 재채색하지 않아요. */
    baseColor: (breedSketches[key]?.coatColor ?? 'cream') as FurColorKey,
    traits: breedCharacterTraits(key)
  };
}
