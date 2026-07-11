ALTER TABLE post_comments
ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER;

ALTER TABLE photo_comments
ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_comments_parent_comment_fk'
  ) THEN
    ALTER TABLE post_comments
    ADD CONSTRAINT post_comments_parent_comment_fk
    FOREIGN KEY (parent_comment_id)
    REFERENCES post_comments(id)
    ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'photo_comments_parent_comment_fk'
  ) THEN
    ALTER TABLE photo_comments
    ADD CONSTRAINT photo_comments_parent_comment_fk
    FOREIGN KEY (parent_comment_id)
    REFERENCES photo_comments(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_comment_id
ON post_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_photo_comments_parent_comment_id
ON photo_comments(parent_comment_id);
