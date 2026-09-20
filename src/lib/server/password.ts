import { compare, hash } from 'bcryptjs';

export const PASSWORD_COST = 12;
// A fixed, unrelated hash makes unknown-user checks take the same work as a password check.
const DUMMY_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

export function hashPassword(password: string) {
  return hash(password, PASSWORD_COST);
}

export async function verifyPassword(password: string, storedHash: string | null) {
  const matches = await compare(password, storedHash ?? DUMMY_HASH);
  return Boolean(storedHash) && matches;
}
