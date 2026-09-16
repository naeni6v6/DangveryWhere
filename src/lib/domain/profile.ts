import type { DogProfile } from './place';

/** 한 계정이 등록할 수 있는 반려견 수. 화면과 서버가 같은 값을 봅니다. */
export const MAX_DOGS = 6;

/** 저장/수정 대상을 가리키는 id. 새로 등록하는 경우에는 없습니다. */
export function validateDogId(value: unknown): string | null {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export function validateProfile(value: unknown): DogProfile | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 20)
    return null;
  if (typeof item.breed !== 'string' || !item.breed.trim() || item.breed.trim().length > 40)
    return null;
  if (item.size !== 'small' && item.size !== 'medium' && item.size !== 'large') return null;
  if (
    typeof item.weight !== 'number' ||
    !Number.isFinite(item.weight) ||
    item.weight < 0.1 ||
    item.weight > 120
  )
    return null;
  if (Math.abs(Math.round(item.weight * 10) - item.weight * 10) > 1e-8) return null;
  return { name: item.name.trim(), breed: item.breed.trim(), size: item.size, weight: item.weight };
}
