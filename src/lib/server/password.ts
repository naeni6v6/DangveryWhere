import { database } from './db';

export const PASSWORD_COST = 12;
// A fixed, unrelated hash makes unknown-user checks take the same work as a password check.
const DUMMY_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
const BCRYPT_HASH = /^\$2[ab]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

export async function hashPassword(password: string) {
  // Neon performs bcrypt at the same cost; the Worker only waits for its HTTPS query.
  const sql = database();
  const [result] = await sql`
    SELECT crypt(${password}, gen_salt('bf', ${PASSWORD_COST})) AS password_hash`;
  const hash = result?.password_hash;
  if (typeof hash !== 'string' || !BCRYPT_HASH.test(hash) || !hash.startsWith('$2a$12$'))
    throw new Error('Password hashing is unavailable');
  return hash;
}

export async function verifyPassword(password: string, storedHash: string | null) {
  const knownHash = typeof storedHash === 'string' && BCRYPT_HASH.test(storedHash);
  // pgcrypto accepts the 2a prefix. For our validated passwords (at most 72 UTF-8
  // bytes), current bcrypt 2a and 2b produce the same digest. Keep stored hashes intact.
  const salt = (knownHash ? storedHash : DUMMY_HASH).replace(/^\$2b\$/, '$2a$');
  const sql = database();
  const [result] = await sql`SELECT crypt(${password}, ${salt}) = ${salt} AS matches`;
  return knownHash && result?.matches === true;
}
