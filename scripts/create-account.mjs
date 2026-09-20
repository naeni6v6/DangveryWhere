import { neon } from '@neondatabase/serverless';
import { hash } from 'bcryptjs';

// Passwords are supplied through the process environment, never source or command arguments.
const username = process.argv[2]?.trim().toLowerCase();
const nickname = process.argv[3]?.trim();
const password = process.env.ACCOUNT_PASSWORD;
if (
  !process.env.DATABASE_URL ||
  !username ||
  !/^[a-z0-9_]{4,24}$/.test(username) ||
  !nickname ||
  [...nickname].length > 20 ||
  /[\u0000-\u001f\u007f]/.test(nickname) ||
  !password ||
  password.length < 8 ||
  new TextEncoder().encode(password).length > 72 ||
  !/[a-zA-Z]/.test(password) ||
  !/[0-9]/.test(password) ||
  /[\u0000-\u001f\u007f]/.test(password)
) {
  console.error(
    'Set DATABASE_URL and ACCOUNT_PASSWORD, then run npm run account:create -- <username> <nickname>.'
  );
  process.exit(1);
}

try {
  const sql = neon(process.env.DATABASE_URL);
  const passwordHash = await hash(password, 12);
  const [created] = await sql`
    INSERT INTO app_users (username, password_hash, nickname)
    VALUES (${username}, ${passwordHash}, ${nickname})
    ON CONFLICT (username) DO NOTHING RETURNING username, nickname`;
  if (!created) {
    console.error('That username already exists. No account was changed.');
    process.exitCode = 1;
  } else {
    console.log(`Account created: ${created.username} (${created.nickname})`);
  }
} catch {
  console.error(
    'Account creation failed. Check the database connection and run npm run db:auth first.'
  );
  process.exitCode = 1;
}
