import type { DogProfile } from './place';

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
