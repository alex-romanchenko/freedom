CREATE INDEX IF NOT EXISTS posts_created_at_id_idx
  ON posts (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS posts_user_created_at_idx
  ON posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS follows_follower_following_idx
  ON follows (follower_id, following_id);

CREATE INDEX IF NOT EXISTS likes_post_user_idx
  ON likes (post_id, user_id);

CREATE INDEX IF NOT EXISTS post_comments_post_id_idx
  ON post_comments (post_id);

CREATE INDEX IF NOT EXISTS user_blocks_pair_idx
  ON user_blocks (blocker_id, blocked_id);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, is_read);
