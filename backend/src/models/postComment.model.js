const db = require('../db');

async function createComment(userId, postId, text) {
  const result = await db.query(
    `
    INSERT INTO post_comments (user_id, post_id, text)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [userId, postId, text]
  );

  return result.rows[0];
}

async function getComments(postId) {
  const result = await db.query(
    `
    SELECT 
      pc.id,
      pc.text,
      pc.created_at,
      u.id AS user_id,
      u.username,
      u.display_name,
      u.avatar
    FROM post_comments pc
    JOIN users u ON u.id = pc.user_id
    WHERE pc.post_id = $1
    ORDER BY pc.created_at ASC
    `,
    [postId]
  );

  return result.rows;
}

async function deleteComment(commentId, userId) {
  const result = await db.query(
    `
    DELETE FROM post_comments
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [commentId, userId]
  );

  return result.rows[0];
}

async function updateComment(commentId, userId, text) {
  const result = await db.query(
    `
    UPDATE post_comments
    SET text = $1
    WHERE id = $2 AND user_id = $3
    RETURNING *
    `,
    [text, commentId, userId]
  );

  return result.rows[0];
}

module.exports = {
  createComment,
  getComments,
  deleteComment,
  updateComment,
};