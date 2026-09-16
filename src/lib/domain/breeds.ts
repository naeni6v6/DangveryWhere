/**
 * 3D 캐릭터가 준비된 견종 목록.
 * 이미지는 static/dogs/<key>.webp (무대용) · static/dogs/thumb/<key>.webp (선택 목록용) 입니다.
 * 저장되는 견종 값은 `label`(한글) 이라 기존 프로필 데이터와 호환됩니다.
 */
export type Breed = {
  key: string;
  label: string;
  /** 직접 입력한 견종에서 이 캐릭터를 찾을 때 쓰는 단어 (공백 무시, 소문자) */
  match: string[];
};

export const breeds: Breed[] = [
  { key: 'maltese', label: '말티즈', match: ['말티즈', 'maltese'] },
  { key: 'poodle', label: '푸들', match: ['푸들', 'poodle'] },
  { key: 'pomeranian', label: '포메라니안', match: ['포메라니안', '포메', 'pomeranian'] },
  { key: 'golden-retriever', label: '골든 리트리버', match: ['골든리트리버', '골든', 'golden'] },
  { key: 'jindo', label: '진돗개', match: ['진돗개', '진도', 'jindo'] },
  { key: 'shih-tzu', label: '시츄', match: ['시츄', '시추', 'shihtzu'] },
  { key: 'chihuahua', label: '치와와', match: ['치와와', 'chihuahua'] },
  { key: 'bichon-frise', label: '비숑 프리제', match: ['비숑', 'bichon'] },
  { key: 'siberian-husky', label: '시베리안 허스키', match: ['허스키', 'husky'] },
  { key: 'welsh-corgi', label: '웰시코기', match: ['웰시코기', '코기', 'corgi'] },
  { key: 'beagle', label: '비글', match: ['비글', 'beagle'] },
  { key: 'greyhound', label: '그레이하운드', match: ['그레이하운드', 'greyhound'] },
  { key: 'dachshund', label: '닥스훈트', match: ['닥스훈트', 'dachshund'] },
  { key: 'french-bulldog', label: '프렌치 불독', match: ['프렌치불독', '불독', 'bulldog'] },
  { key: 'miniature-schnauzer', label: '미니어처 슈나우저', match: ['슈나우저', 'schnauzer'] },
  { key: 'labrador-retriever', label: '래브라도 리트리버', match: ['래브라도', '리트리버', 'labrador', 'retriever'] },
  { key: 'shiba-inu', label: '시바견', match: ['시바', 'shiba'] },
  { key: 'papillon', label: '파피용', match: ['파피용', 'papillon'] }
];

export const breedImage = (breed: Breed) => `/dogs/${breed.key}.webp`;
export const breedThumb = (breed: Breed) => `/dogs/thumb/${breed.key}.webp`;

const normalize = (value: string) => value.toLocaleLowerCase('ko').replace(/[\s·_-]/g, '');

/** 목록에서 고른 값과 정확히 같은 견종 */
export function breedByLabel(value: string): Breed | undefined {
  const target = normalize(value);
  if (!target) return undefined;
  return breeds.find((breed) => normalize(breed.label) === target);
}

/** 직접 입력한 값까지 포함해 가장 잘 맞는 캐릭터 (예: '말티즈 믹스' → 말티즈) */
export function findBreed(value: string): Breed | undefined {
  const target = normalize(value);
  if (!target) return undefined;
  return (
    breedByLabel(value) ??
    breeds.find((breed) => breed.match.some((word) => target.includes(normalize(word))))
  );
}
