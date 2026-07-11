const db = require('../db');

async function createComment(userId, postId, text, parentCommentId = null) {
  let rootCommentId = null;

  if (parentCommentId) {
    const parentResult = await db.query(
      `SELECT id, parent_comment_id
       FROM post_comments
       WHERE id = $1 AND post_id = $2`,
      [parentCommentId, postId]
    );

    if (!parentResult.rows[0]) {
      const error = new Error('Reply target not found');
      error.statusCode = 400;
      throw error;
    }

    rootCommentId = parentResult.rows[0].parent_comment_id || parentResult.rows[0].id;
  }

  const result = await db.query(
    `
    INSERT INTO post_comments (user_id, post_id, text, parent_comment_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [userId, postId, text, rootCommentId]
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
      pc.parent_comment_id,
      u.id AS user_id,
      u.username,
      u.display_name,
      u.avatar,
      parent_user.username AS reply_to_username,
      parent_user.display_name AS reply_to_display_name
    FROM post_comments pc
    JOIN users u ON u.id = pc.user_id
    LEFT JOIN post_comments parent ON parent.id = pc.parent_comment_id
    LEFT JOIN users parent_user ON parent_user.id = parent.user_id
    WHERE pc.post_id = $1
    ORDER BY COALESCE(pc.parent_comment_id, pc.id),
      CASE WHEN pc.parent_comment_id IS NULL THEN 0 ELSE 1 END,
      pc.created_at ASC
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
