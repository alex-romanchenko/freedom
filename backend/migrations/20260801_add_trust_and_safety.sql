ALTER TABLE users
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_blocks (
  id BIGSERIAL PRIMARY KEY,
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT user_blocks_unique UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks(blocked_id);

CREATE TABLE IF NOT EXISTS content_reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id BIGINT,
  reason VARCHAR(32) NOT NULL,
  details TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT content_reports_entity_type_check CHECK (
    entity_type IN ('user', 'post', 'post_comment', 'photo', 'photo_comment', 'message')
  ),
  CONSTRAINT content_reports_reason_check CHECK (
    reason IN ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'other')
  ),
  CONSTRAINT content_reports_status_check CHECK (
    status IN ('pending', 'reviewing', 'resolved', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_reporter_idx
  ON content_reports(reporter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  username VARCHAR(100),
  details TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT account_deletion_requests_status_check CHECK (
    status IN ('pending', 'processing', 'completed', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS account_deletion_requests_status_idx
  ON account_deletion_requests(status, created_at DESC);
