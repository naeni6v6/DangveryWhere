-- Keep the bcrypt work factor while moving CPU-heavy password work off the Worker.
-- Existing account hashes and sessions are preserved.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
