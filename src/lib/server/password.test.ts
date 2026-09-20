import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password storage', () => {
  it('salts each password and compares the exact password', async () => {
    const password = 'AccountTest2026!';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(password);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^\$2[ab]\$12\$/);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('accounttest2026!', first)).toBe(false);
    expect(await verifyPassword(password, null)).toBe(false);
  });
});
