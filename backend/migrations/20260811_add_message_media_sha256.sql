ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_sha256 VARCHAR(64);

CREATE INDEX IF NOT EXISTS messages_sender_media_sha256_idx
  ON messages (sender_id, media_sha256)
  WHERE media_sha256 IS NOT NULL;
