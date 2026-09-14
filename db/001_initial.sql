BEGIN;
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS app_sessions_expiry ON app_sessions(expires_at);
CREATE TABLE IF NOT EXISTS dog_profiles (
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
  breed text NOT NULL CHECK (char_length(breed) BETWEEN 1 AND 40),
  size text NOT NULL CHECK (size IN ('small','medium','large')),
  weight numeric(4,1) NOT NULL CHECK (weight > 0 AND weight <= 120),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  place_id text NOT NULL CHECK (place_id ~ '^gw-[0-9]+$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);
COMMIT;

-- Run using a server-only Neon role. The browser never receives database credentials.
-- Profile and favorite queries must always include the authenticated user_id.
-- Periodic maintenance: DELETE FROM app_sessions WHERE expires_at < now();
