const db = require('../db');

async function createNotification({
  userId,
  senderId,
  type,
  entityId = null,
  entityType = null,
  text = null,
}) {
  const result = await db.query(
    `
    INSERT INTO notifications (
      user_id,
      sender_id,
      type,
      entity_id,
      entity_type,
      text
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [userId, senderId, type, entityId, entityType, text]
  );

  return result.rows[0];
}

async function getNotifications(userId, limit = 20, offset = 0) {
  const result = await db.query(
    `
    SELECT 
      n.*,

      u.username,
      u.display_name,
      u.avatar,

      c.group_name,
      c.group_avatar,
      c.is_group

    FROM notifications n

    LEFT JOIN users u 
      ON u.id = n.sender_id

    LEFT JOIN conversations c 
      ON c.id = n.entity_id
      AND n.entity_type = 'conversation'

    WHERE n.user_id = $1
    ORDER BY n.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  return result.rows;
}

async function markAllAsRead(userId) {
  await db.query(
    `
    UPDATE notifications
    SET is_read = true
    WHERE user_id = $1
    `,
    [userId]
  );
}

async function deleteNotification(id, userId) {
  const result = await db.query(
    `
    DELETE FROM notifications
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [id, userId]
  );

  return result.rows[0];
}

module.exports = {
  createNotification,
  getNotifications,
  markAllAsRead,
  deleteNotification,
};