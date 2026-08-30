ALTER TABLE messages
ADD COLUMN IF NOT EXISTS media_batch_id VARCHAR(80);

CREATE INDEX IF NOT EXISTS messages_conversation_media_batch_idx
ON messages (conversation_id, media_batch_id, created_at DESC, id DESC)
WHERE media_batch_id IS NOT NULL AND is_deleted = false;
