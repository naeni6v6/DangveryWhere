import { describe, expect, it } from 'vitest';
import { validateProfile } from './profile';
const profile = { name: ' 두부 ', breed: '믹스', size: 'small', weight: 4.5 };
describe('profile validation', () => {
  it('normalizes a valid profile', () => expect(validateProfile(profile)?.name).toBe('두부'));
  it.each([NaN, Infinity, -1, 0, 120.1, '5', 4.55])('rejects invalid weight %s', (weight) => {
    expect(validateProfile({ ...profile, weight })).toBeNull();
  });
  it('rejects empty names and unsupported sizes', () => {
    expect(validateProfile({ ...profile, name: ' ' })).toBeNull();
    expect(validateProfile({ ...profile, size: 'unknown' })).toBeNull();
  });
});
