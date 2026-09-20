import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { compare } from 'bcryptjs';
import { unflatten } from 'devalue';

// Optional local integration check. Creates two temporary accounts, then removes only those accounts.
const origin = process.env.AUTH_TEST_ORIGIN ?? 'http://localhost:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('This check only runs against a local app.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const sql = neon(process.env.DATABASE_URL);
const suffix = randomBytes(5).toString('hex');
const names = [`qa_${suffix}_a`, `qa_${suffix}_b`];
const password = `Check${randomBytes(12).toString('hex')}!`;
const cookies = new Set();
const digest = (value) => createHash('sha256').update(value).digest('hex');

async function send(path, body, cookie, method = 'POST', requestOrigin = origin) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      origin: requestOrigin,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(body)
  });
  const session = response.headers.getSetCookie().find((value) => value.startsWith('dw_session='));
  const nextCookie = session?.split(';')[0];
  if (nextCookie && !nextCookie.endsWith('=')) cookies.add(nextCookie);
  return { response, data: await response.json(), cookie: nextCookie };
}

async function account(cookie, path = '/mobile') {
  const response = await fetch(`${origin}${path}/__data.json`, { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const payload = await response.json();
  const node = payload.nodes.find((value) => value?.type === 'data' && value.data);
  return unflatten(node.data);
}

try {
  if (process.env.AUTH_TEST_PASSWORD) {
    const judge = await send('/auth/login', {
      username: process.env.AUTH_TEST_USERNAME ?? 'openapi',
      password: process.env.AUTH_TEST_PASSWORD
    });
    assert.equal(judge.response.status, 200);
    assert.equal(judge.data.user.nickname, process.env.AUTH_TEST_NICKNAME ?? '테스트계정');
    assert.match(judge.response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(judge.response.headers.get('set-cookie'), /SameSite=Lax/);
    for (const route of ['', '/web']) {
      const loaded = await account(judge.cookie, route);
      assert.equal(loaded.user.id, judge.data.user.id);
      assert.equal(loaded.user.nickname, judge.data.user.nickname);
      assert.equal(loaded.accountUnavailable, false);
    }
    await send('/auth/logout', {}, judge.cookie);
    const revoked = await send('/api/profile', {}, judge.cookie, 'PUT');
    assert.equal(revoked.response.status, 401);
    console.log(
      'PASS: judge login, nickname in mobile/PC data, protected session, logout revocation.'
    );
  }

  const makeInput = (index) => ({
    username: names[index],
    nickname: `가입확인${index + 1}`,
    password,
    passwordConfirm: password
  });
  const first = await send('/auth/signup', makeInput(0));
  assert.equal(first.response.status, 201);
  const duplicate = await send('/auth/signup', {
    ...makeInput(0),
    username: names[0].toUpperCase(),
    nickname: '덮어쓰기 시도'
  });
  assert.equal(duplicate.response.status, 409);
  const second = await send('/auth/signup', makeInput(1));
  assert.equal(second.response.status, 201);
  assert.notEqual(first.data.user.id, second.data.user.id);
  assert.equal((await account(first.cookie)).user.nickname, '가입확인1');
  const [stored] = await sql`SELECT password_hash FROM app_users WHERE id=${first.data.user.id}`;
  assert.match(stored.password_hash, /^\$2[ab]\$12\$/);
  assert.notEqual(stored.password_hash, password);
  const [otherStored] = await sql`SELECT password_hash FROM app_users WHERE id=${second.data.user.id}`;
  assert.notEqual(stored.password_hash, otherStored.password_hash);
  assert.equal(await compare(password, stored.password_hash), true);
  assert.equal(await compare(password, otherStored.password_hash), true);
  console.log('PASS: signup, automatic login, duplicate username protection, hashed storage.');

  const dog = { name: '계정분리확인', breed: '믹스견', size: 'small', weight: 5 };
  const saved = await send('/api/profile', dog, first.cookie, 'PUT');
  assert.equal(saved.response.status, 200);
  const [place] = await sql`SELECT id FROM places ORDER BY id LIMIT 1`;
  const favorite = await send(
    '/api/favorites',
    { placeId: place.id, saved: true },
    first.cookie,
    'PUT'
  );
  assert.equal(favorite.response.status, 200);
  const dataA = await account(first.cookie);
  const dataB = await account(second.cookie);
  assert.equal(dataA.dogs.length, 1);
  assert.equal(dataA.dogs[0].name, dog.name);
  assert.equal(dataA.favorites.length, 1);
  assert.equal(dataB.dogs.length, 0);
  assert.equal(dataB.favorites.length, 0);
  const foreignEdit = await send(
    '/api/profile',
    { ...dog, id: saved.data.dog.id },
    second.cookie,
    'PUT'
  );
  assert.equal(foreignEdit.response.status, 404);
  const foreignDelete = await send(
    '/api/profile',
    { id: saved.data.dog.id },
    second.cookie,
    'DELETE'
  );
  assert.equal(foreignDelete.response.status, 404);
  console.log(
    'PASS: dogs and favorites stay with their account; another account cannot edit/delete them.'
  );

  const wrong = await send('/auth/login', { username: names[0], password: 'WrongPassword2026!' });
  assert.equal(wrong.response.status, 401);
  assert.equal(wrong.cookie, undefined);
  const foreign = await send(
    '/auth/login',
    { username: names[0], password },
    undefined,
    'POST',
    'https://foreign.example'
  );
  assert.equal(foreign.response.status, 403);
  const relogin = await send(
    '/auth/login',
    { username: names[0].toUpperCase(), password },
    first.cookie
  );
  assert.equal(relogin.response.status, 200);
  assert.equal(relogin.data.user.id, first.data.user.id);
  assert.equal(relogin.data.dogs[0].id, saved.data.dog.id);
  assert.equal(relogin.data.favorites.length, 1);
  assert.equal(relogin.data.accountUnavailable, false);
  assert.notEqual(relogin.cookie, first.cookie);
  assert.equal((await send('/api/profile', dog, first.cookie, 'PUT')).response.status, 401);
  assert.equal((await account(relogin.cookie)).dogs[0].id, saved.data.dog.id);
  await send('/auth/logout', {}, relogin.cookie);
  assert.equal((await send('/api/profile', dog, relogin.cookie, 'PUT')).response.status, 401);
  console.log(
    'PASS: wrong password, cross-origin rejection, case-insensitive relogin, session rotation and persistence.'
  );
} finally {
  for (const cookie of cookies) {
    await sql`DELETE FROM app_sessions WHERE token_hash=${digest(cookie.split('=')[1])}`;
  }
  for (const username of names) {
    await sql`DELETE FROM app_users WHERE username=${username}`;
    await sql`DELETE FROM auth_rate_limits WHERE key_hash=${digest(`login:user:${username}`)}`;
  }
  console.log('Temporary test accounts and sessions removed.');
}
