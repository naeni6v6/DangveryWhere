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

/**
 * 화면에 나오는 차례가 곧 이 목록의 차례입니다.
 * 견종 고르는 칸은 다섯 칸짜리 격자이고 '믹스 / 잘 모름'·'기타 / 직접 입력' 두 칸이 뒤에 붙어서,
 * 23종이면 25칸으로 딱 떨어집니다. 한 종을 더하려면 한 종을 빼야 줄이 안 삐져나와요.
 *
 * 한 줄에 다섯 마리씩, 줄마다 결이 같은 아이들끼리 묶었습니다.
 *   1줄 실내에서 많이 보는 소형견 · 2줄 나머지 소형견
 *   3줄 중형견 · 4줄 대형견(리트리버 둘은 꼭 나란히) · 5줄 잘 달리는 큰 아이들
 */
export const breeds: Breed[] = [
  // 1줄 — 가장 많이 찾는 소형견
  { key: 'maltese', label: '말티즈', match: ['말티즈', 'maltese'] },
  { key: 'pomeranian', label: '포메라니안', match: ['포메라니안', '포메', 'pomeranian'] },
  { key: 'bichon-frise', label: '비숑 프리제', match: ['비숑', 'bichon'] },
  { key: 'poodle', label: '푸들', match: ['푸들', 'poodle'] },
  { key: 'shih-tzu', label: '시츄', match: ['시츄', '시추', 'shihtzu'] },
  // 2줄 — 나머지 소형견
  { key: 'yorkshire-terrier', label: '요크셔테리어', match: ['요크셔테리어', '요크셔', '요키', 'yorkshire', 'yorkie'] },
  { key: 'chihuahua', label: '치와와', match: ['치와와', 'chihuahua'] },
  { key: 'papillon', label: '파피용', match: ['파피용', 'papillon'] },
  { key: 'dachshund', label: '닥스훈트', match: ['닥스훈트', 'dachshund'] },
  { key: 'pug', label: '퍼그', match: ['퍼그', 'pug'] },
  // 3줄 — 중형견
  { key: 'french-bulldog', label: '프렌치 불독', match: ['프렌치불독', '불독', 'bulldog'] },
  { key: 'welsh-corgi', label: '웰시코기', match: ['웰시코기', '코기', 'corgi'] },
  { key: 'beagle', label: '비글', match: ['비글', 'beagle'] },
  { key: 'shiba-inu', label: '시바견', match: ['시바', 'shiba'] },
  { key: 'jindo', label: '진돗개', match: ['진돗개', '진도', 'jindo'] },
  // 4줄 — 대형견. 리트리버 둘은 꼭 나란히 둡니다.
  { key: 'samoyed', label: '사모예드', match: ['사모예드', 'samoyed'] },
  { key: 'german-shepherd', label: '저먼셰퍼드', match: ['저먼셰퍼드', '져먼셰퍼드', '셰퍼드', '쉐퍼드', 'germanshepherd', 'shepherd'] },
  { key: 'golden-retriever', label: '골든 리트리버', match: ['골든리트리버', '골든', 'golden'] },
  { key: 'labrador-retriever', label: '래브라도 리트리버', match: ['래브라도', '리트리버', 'labrador', 'retriever'] },
  { key: 'rottweiler', label: '로트와일러', match: ['로트와일러', '롯트와일러', 'rottweiler'] },
  // 5줄 — 잘 달리는 큰 아이들
  { key: 'border-collie', label: '보더콜리', match: ['보더콜리', '보더', 'bordercollie', 'collie'] },
  { key: 'siberian-husky', label: '시베리안 허스키', match: ['허스키', 'husky'] },
  { key: 'greyhound', label: '그레이하운드', match: ['그레이하운드', 'greyhound'] }
];

export const breedImage = (breed: Breed) => `/dogs/${breed.key}.webp`;
export const breedThumb = (breed: Breed) => `/dogs/thumb/${breed.key}.webp`;
/**
 * 배경을 지운 판 (static/dogs/cut/<key>.webp · scripts/breed-cutout.py 로 만듭니다).
 * 무대(/web/dog)는 그려진 바닥 그림자를 쓰려고 흰 배경 원본에 multiply 를 걸지만,
 * 아이보리 카드 위에 그냥 얹는 자리에서는 그 그림자가 얼룩으로 남고 흰 털도 탁해져요.
 * 그런 자리에서는 이쪽을 씁니다.
 */
export const breedCutout = (breed: Breed) => `/dogs/cut/${breed.key}.webp`;

/**
 * '미지의 강아지' — 견종을 '기타 / 직접 입력'이나 '믹스 / 잘 모름'으로 둔 아이의 캐릭터.
 * 세부 없이 안개 낀 실루엣만 있는 투명 그림이라 multiply 없이 어디에나 얹을 수 있어요.
 * (scripts/mystery-dog.py 로 만듭니다)
 */
export const MYSTERY_IMAGE = '/dogs/mystery.webp';
export const MYSTERY_THUMB = '/dogs/thumb/mystery.webp';

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
