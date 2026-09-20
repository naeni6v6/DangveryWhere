import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ database: vi.fn() }));

import { database } from './db';
import { hashPassword, verifyPassword } from './password';

const legacyHash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
const databaseHash = legacyHash.replace('$2b$', '$2a$');
const sql = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(database).mockReturnValue(sql as unknown as ReturnType<typeof database>);
});

describe('database password hashing', () => {
  it('keeps bcrypt cost 12 and sends the password as a bound parameter', async () => {
    sql.mockResolvedValue([{ password_hash: databaseHash }]);
    expect(await hashPassword('AccountTest2026!')).toBe(databaseHash);
    const [query, password, cost] = sql.mock.calls[0];
    expect(query.join('?')).not.toContain('AccountTest2026!');
    expect(query.join('?')).toContain("gen_salt('bf'");
    expect(password).toBe('AccountTest2026!');
    expect(cost).toBe(12);
  });

  it.each([undefined, 'plaintext', databaseHash.replace('$12$', '$06$')])(
    'rejects missing, invalid or weakened hashing results',
    async (password_hash) => {
      sql.mockResolvedValue([{ password_hash }]);
      await expect(hashPassword('AccountTest2026!')).rejects.toThrow('unavailable');
    }
  );

  it.each([legacyHash, databaseHash])('verifies existing 2b and new 2a hashes', async (hash) => {
    sql.mockResolvedValue([{ matches: true }]);
    expect(await verifyPassword('AccountTest2026!', hash)).toBe(true);
    expect(sql.mock.calls[0].slice(1)).toEqual(['AccountTest2026!', databaseHash, databaseHash]);
  });

  it.each([null, 'invalid-hash'])(
    'performs dummy work without accepting an unknown hash',
    async (hash) => {
      sql.mockResolvedValue([{ matches: true }]);
      expect(await verifyPassword('AccountTest2026!', hash)).toBe(false);
      expect(sql).toHaveBeenCalledOnce();
    }
  );

  it.each([false, undefined, 'true'])(
    'requires an actual successful database comparison',
    async (matches) => {
      sql.mockResolvedValue([{ matches }]);
      expect(await verifyPassword('WrongPassword2026!', legacyHash)).toBe(false);
    }
  );
});
