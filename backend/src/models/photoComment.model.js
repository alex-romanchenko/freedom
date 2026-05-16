const db = require('../db');

async function createComment(userId, photoId, text) {
  const result = await db.query(
    `
    INSERT INTO photo_comments (user_id, photo_id, text)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [userId, photoId, text]
  );

  return result.rows[0];
}

async function getComments(photoId) {
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
    FROM photo_comments pc
    JOIN users u ON u.id = pc.user_id
    WHERE pc.photo_id = $1
    ORDER BY pc.created_at ASC
    `,
    [photoId]
  );

  return result.rows;
}

async function deleteComment(commentId, userId) {
  const result = await db.query(
    `
    DELETE FROM photo_comments
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
    UPDATE photo_comments
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