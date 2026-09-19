/**
 * 스타일 참고용 견종 캐릭터 (static/dogs/<key>.webp) 를 서버에서 읽습니다.
 * 개발 중에는 파일에서, Cloudflare 배포에서는 ASSETS 바인딩에서 읽어 오도록 `read` 를 씁니다.
 */
import { read } from '$app/server';
import { breeds } from '$lib/domain/breeds';
import type { DogTraits } from '$lib/domain/character';
import type { InlineImage } from './gemini';

const files = import.meta.glob<string>('/static/dogs/*.webp', {
  eager: true,
  query: '?url',
  import: 'default'
});

function urlFor(key: string): string | undefined {
  const entry = Object.entries(files).find(([path]) => path.endsWith(`/dogs/${key}.webp`));
  return entry?.[1];
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

const cache = new Map<string, Promise<InlineImage | null>>();

/** 견종 key 의 캐릭터 그림. 없으면 null. */
export function referenceImage(key: string): Promise<InlineImage | null> {
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      const url = urlFor(key);
      if (!url) return null;
      const bytes = new Uint8Array(await read(url).arrayBuffer());
      return { mimeType: 'image/webp', data: toBase64(bytes) };
    })().catch((error) => {
      console.error(`[character] reference ${key} unreadable`, error);
      cache.delete(key);
      return null;
    });
    cache.set(key, pending);
  }
  return pending;
}

/**
 * 사진의 특징과 가장 닮은 캐릭터 세 마리를 고릅니다.
 * 첫째는 견종이 같은 캐릭터, 나머지는 귀 모양·털 질감이 비슷한 캐릭터라서
 * 생성 모델이 "이 세계관에서 이런 털·귀는 이렇게 그린다"를 배울 수 있어요.
 */
export function pickReferenceKeys(traits: DogTraits): string[] {
  const keys: string[] = [];
  const push = (key?: string | null) => {
    if (key && breeds.some((breed) => breed.key === key) && !keys.includes(key)) keys.push(key);
  };
  push(traits.breedKey);
  const byTexture: Record<DogTraits['furTexture'], string[]> = {
    curly: ['poodle', 'bichon-frise'],
    fluffy: ['pomeranian', 'bichon-frise', 'maltese'],
    long: ['maltese', 'shih-tzu', 'papillon'],
    wiry: ['miniature-schnauzer', 'jindo'],
    smooth: ['chihuahua', 'beagle', 'french-bulldog']
  };
  const byEar: Record<DogTraits['earType'], string[]> = {
    floppy: ['golden-retriever', 'beagle', 'dachshund'],
    upright: ['shiba-inu', 'welsh-corgi', 'siberian-husky'],
    semi: ['jindo', 'greyhound', 'papillon'],
    button: ['labrador-retriever', 'miniature-schnauzer']
  };
  for (const key of byTexture[traits.furTexture]) if (keys.length < 2) push(key);
  for (const key of byEar[traits.earType]) if (keys.length < 3) push(key);
  for (const key of ['maltese', 'shiba-inu', 'golden-retriever']) if (keys.length < 3) push(key);
  return keys.slice(0, 3);
}
