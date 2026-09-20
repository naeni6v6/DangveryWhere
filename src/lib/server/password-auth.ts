import { error, isHttpError, json, type RequestEvent } from '@sveltejs/kit';
import { normalizeNickname, normalizeUsername, passwordIsValid } from '$lib/domain/credentials';
import { checkOrigin, hashToken, issueSession } from './auth';
import { database } from './db';
import { hashPassword, verifyPassword } from './password';
import { loadAccountData } from './account';

async function limitAttempts(key: string, maximum: number, windowSeconds: number) {
  const sql = database();
  const keyHash = await hashToken(key);
  const [row] = await sql`
    INSERT INTO auth_rate_limits (key_hash, attempts, expires_at)
    VALUES (${keyHash}, 1, now() + ${windowSeconds} * interval '1 second')
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN auth_rate_limits.expires_at <= now() THEN 1
        ELSE LEAST(auth_rate_limits.attempts + 1, ${maximum + 1}) END,
      expires_at = CASE WHEN auth_rate_limits.expires_at <= now()
        THEN excluded.expires_at ELSE auth_rate_limits.expires_at END
    RETURNING attempts`;
  if (Number(row.attempts) > maximum) error(429, '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.');
}

export async function authenticateWithPassword(event: RequestEvent, mode: 'login' | 'signup') {
  checkOrigin(event.request, event.url.origin);
  if (!event.request.headers.get('content-type')?.startsWith('application/json'))
    error(415, '올바른 형식으로 입력해 주세요.');
  // Bound both declared and streamed request sizes before parsing user input.
  if (Number(event.request.headers.get('content-length')) > 4096)
    error(413, '입력 내용이 너무 길어요.');
  const reader = event.request.body?.getReader();
  if (!reader) error(400, '아이디와 비밀번호를 입력해 주세요.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) {
      await reader.cancel();
      error(413, '입력 내용이 너무 길어요.');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(new TextDecoder().decode(body));
  } catch {
    error(400, '입력 내용을 확인해 주세요.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    error(400, '입력 내용을 확인해 주세요.');
  const username = normalizeUsername(input.username);
  if (!username) error(400, '아이디는 영문, 숫자, 밑줄(_)로 4~24자 입력해 주세요.');
  if (!passwordIsValid(input.password))
    error(400, '비밀번호는 영문과 숫자를 포함해 8자 이상, 72바이트 이하로 입력해 주세요.');
  const password = input.password;
  const nickname = mode === 'signup' ? normalizeNickname(input.nickname) : null;
  if (mode === 'signup') {
    if (!nickname) error(400, '닉네임은 1~20자로 입력해 주세요.');
    if (password !== input.passwordConfirm) error(400, '비밀번호가 서로 일치하지 않아요.');
  }

  try {
    const sql = database();
    const clientKey = `${mode}:ip:${event.getClientAddress()}`;
    let user: { id: string; username: string; nickname: string };
    if (mode === 'signup') {
      await limitAttempts(clientKey, 5, 600);
      const passwordHash = await hashPassword(password);
      const [created] = await sql`
        INSERT INTO app_users (username, password_hash, nickname)
        VALUES (${username}, ${passwordHash}, ${nickname})
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username, nickname`;
      if (!created) error(409, '이미 사용 중인 아이디예요. 다른 아이디를 입력해 주세요.');
      user = created as typeof user;
    } else {
      // These independent checks share a network round trip in time. Password work still
      // starts only after both durable rate limits have passed.
      const [, , rows] = await Promise.all([
        limitAttempts(clientKey, 40, 600),
        limitAttempts(`login:user:${username}`, 10, 600),
        sql`SELECT id, username, nickname, password_hash FROM app_users WHERE username=${username}`
      ]);
      const [existing] = rows;
      const valid = await verifyPassword(password, (existing?.password_hash as string) ?? null);
      if (!existing || !valid) error(401, '아이디 또는 비밀번호가 올바르지 않아요.');
      user = {
        id: existing.id as string,
        username: existing.username as string,
        nickname: existing.nickname as string
      };
    }
    const [, account] = await Promise.all([
      issueSession(user.id, event.cookies, event.url.protocol === 'https:'),
      loadAccountData({ user }),
      mode === 'login'
        ? hashToken(`login:user:${username}`).then(
            (keyHash) => sql`DELETE FROM auth_rate_limits WHERE key_hash=${keyHash}`
          )
        : Promise.resolve()
    ]);
    return json(account, { status: mode === 'signup' ? 201 : 200 });
  } catch (failure) {
    if (isHttpError(failure)) throw failure;
    // Never return driver errors, password hashes, or database connection details.
    error(503, '계정 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.');
  }
}
