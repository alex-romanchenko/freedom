BEGIN;
-- Fails safely if existing emails differ only by case. Resolve those manually first.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users (google_sub);
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
COMMIT;
