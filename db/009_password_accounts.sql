BEGIN;
ALTER TABLE app_users ALTER COLUMN kakao_id DROP NOT NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username text
  CHECK (username ~ '^[a-z0-9_]{4,24}$');
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS nickname text NOT NULL DEFAULT '댕집사'
  CHECK (char_length(nickname) BETWEEN 1 AND 20);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_unique ON app_users (username);
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_login_identity;
ALTER TABLE app_users ADD CONSTRAINT app_users_login_identity CHECK (
  (username IS NULL AND password_hash IS NULL AND kakao_id IS NOT NULL)
  OR (username IS NOT NULL AND password_hash IS NOT NULL)
);

-- Shared across Worker instances; only hashes of rate-limit identifiers are stored.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_expiry ON auth_rate_limits (expires_at);
COMMIT;
