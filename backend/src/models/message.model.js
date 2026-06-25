const pool = require('../db');

async function findOrCreateConversation(userId, otherUserId) {
  const userOneId = Math.min(Number(userId), Number(otherUserId));
  const userTwoId = Math.max(Number(userId), Number(otherUserId));

  const result = await pool.query(
    `INSERT INTO conversations (user_one_id, user_two_id)
     VALUES ($1, $2)
     ON CONFLICT (user_one_id, user_two_id)
     DO UPDATE SET user_one_id = EXCLUDED.user_one_id
     RETURNING *`,
    [userOneId, userTwoId]
  );

  return result.rows[0];
}

async function getGroupMemberIds(conversationId) {
  const result = await pool.query(
    `
    SELECT user_id
    FROM conversation_members
    WHERE conversation_id = $1
    `,
    [conversationId]
  );

  return result.rows.map((row) => row.user_id);
}

async function getConversationById(conversationId) {
  const result = await pool.query(
    `
    SELECT
      id,
      is_group,
      group_name,
      group_avatar
    FROM conversations
    WHERE id = $1
    `,
    [conversationId]
  );

  return result.rows[0];
}

async function createMessage({
  conversationId,
  senderId,
  text,
  image,
  video,
  audio,
  audioDuration,
}) {
  const result = await pool.query(
    `INSERT INTO messages (
      conversation_id,
      sender_id,
      text,
      image,
      video,
      audio,
      audio_duration,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent')
    RETURNING
      id,
      conversation_id,
      sender_id,
      text,
      image,
      video,
      audio,
      audio_duration,
      status,
      created_at`,
    [
      conversationId,
      senderId,
      text || '',
      image || null,
      video || null,
      audio || null,
      audioDuration || 0,
    ]
  );

  await pool.query(
    `UPDATE conversations
     SET updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [conversationId]
  );

  return result.rows[0];
}

async function ensureMessageReactionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reaction TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id)
    )
  `);
}

async function getReactionRows(messageIds, currentUserId = null) {
  if (!messageIds.length) return [];

  const result = await pool.query(
    `
    SELECT
      message_id,
      reaction,
      COUNT(*)::int AS count,
      BOOL_OR(user_id = $2) AS reacted_by_me
    FROM message_reactions
    WHERE message_id = ANY($1::int[])
    GROUP BY message_id, reaction
    ORDER BY MIN(created_at)
    `,
    [messageIds, currentUserId]
  );

  return result.rows;
}

async function attachReactionsToMessages(messages, currentUserId = null) {
  const messageIds = messages.map((message) => Number(message.id));
  const reactionRows = await getReactionRows(messageIds, currentUserId);

  const reactionsByMessageId = reactionRows.reduce((acc, row) => {
    const id = Number(row.message_id);

    if (!acc[id]) acc[id] = [];

    acc[id].push({
      reaction: row.reaction,
      count: Number(row.count || 0),
      reacted_by_me: Boolean(row.reacted_by_me),
    });

    return acc;
  }, {});

  return messages.map((message) => ({
    ...message,
    reactions: reactionsByMessageId[Number(message.id)] || [],
  }));
}

async function getMessageReactions(messageId, currentUserId = null) {
  const rows = await getReactionRows([Number(messageId)], currentUserId);

  return rows.map((row) => ({
    reaction: row.reaction,
    count: Number(row.count || 0),
    reacted_by_me: Boolean(row.reacted_by_me),
  }));
}

async function setMessageReaction({ messageId, userId, reaction }) {
  if (!reaction) {
    await pool.query(
      `
      DELETE FROM message_reactions
      WHERE message_id = $1 AND user_id = $2
      `,
      [messageId, userId]
    );

    return getMessageReactions(messageId, userId);
  }

  await pool.query(
    `
    INSERT INTO message_reactions (message_id, user_id, reaction)
    VALUES ($1, $2, $3)
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET reaction = EXCLUDED.reaction, created_at = CURRENT_TIMESTAMP
    `,
    [messageId, userId, reaction]
  );

  return getMessageReactions(messageId, userId);
}

async function getUserConversations(userId) {
  const result = await pool.query(`
    SELECT *
    FROM (
      SELECT 
        conversations.id,
        conversations.updated_at,
        false AS is_group,
        'private' AS type,

        users.id AS user_id,
        users.username,
        users.display_name,
        users.avatar,
        users.last_seen,

        NULL AS group_name,
        NULL AS group_avatar,
        NULL AS admin_id,

        last_message.text AS last_message_text,
        last_message.created_at AS last_message_created_at,
        last_message.sender_id AS last_message_sender_id,
        last_message.status AS last_message_status,
        last_message.image AS last_message_image,
        last_message.video AS last_message_video,
        last_message.audio AS last_message_audio,
        last_message.audio_duration AS last_message_audio_duration,

        COUNT(unread_messages.id) AS unread_count

      FROM conversations

      JOIN users 
        ON users.id = 
          CASE 
            WHEN conversations.user_one_id = $1 THEN conversations.user_two_id
            ELSE conversations.user_one_id
          END

      LEFT JOIN LATERAL (
        SELECT messages.*
        FROM messages
        WHERE messages.conversation_id = conversations.id
          AND messages.is_deleted = false
        ORDER BY messages.created_at DESC
        LIMIT 1
      ) AS last_message ON true

      LEFT JOIN conversation_reads 
        ON conversation_reads.conversation_id = conversations.id
        AND conversation_reads.user_id = $1

      LEFT JOIN messages AS unread_messages
        ON unread_messages.conversation_id = conversations.id
        AND unread_messages.sender_id <> $1
        AND unread_messages.is_deleted = false
        AND (
          conversation_reads.last_read_at IS NULL
          OR unread_messages.created_at > conversation_reads.last_read_at
        )

      WHERE conversations.is_group = false
        AND (
          conversations.user_one_id = $1 
          OR conversations.user_two_id = $1
        )

      GROUP BY 
        conversations.id,
        users.id,
        users.username,
        users.display_name,
        users.avatar,
        users.last_seen,
        last_message.text,
        last_message.created_at,
        last_message.sender_id,
        last_message.status,
        last_message.image,
        last_message.video,
        last_message.audio,
        last_message.audio_duration

      UNION ALL

      SELECT
        conversations.id,
        conversations.updated_at,
        true AS is_group,
        'group' AS type,

        NULL AS user_id,
        NULL AS username,
        conversations.group_name AS display_name,
        conversations.group_avatar AS avatar,
        NULL AS last_seen,

        conversations.group_name,
        conversations.group_avatar,
        conversations.admin_id,

        last_message.text AS last_message_text,
        last_message.created_at AS last_message_created_at,
        last_message.sender_id AS last_message_sender_id,
        last_message.status AS last_message_status,
        last_message.image AS last_message_image,
        last_message.video AS last_message_video,
        last_message.audio AS last_message_audio,
        last_message.audio_duration AS last_message_audio_duration,

        COUNT(unread_messages.id) AS unread_count

      FROM conversations

      JOIN conversation_members
        ON conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = $1

      LEFT JOIN LATERAL (
        SELECT messages.*
        FROM messages
        WHERE messages.conversation_id = conversations.id
          AND messages.is_deleted = false
        ORDER BY messages.created_at DESC
        LIMIT 1
      ) AS last_message ON true

      LEFT JOIN conversation_reads 
        ON conversation_reads.conversation_id = conversations.id
        AND conversation_reads.user_id = $1

      LEFT JOIN messages AS unread_messages
        ON unread_messages.conversation_id = conversations.id
        AND unread_messages.sender_id <> $1
        AND unread_messages.is_deleted = false
        AND (
          conversation_reads.last_read_at IS NULL
          OR unread_messages.created_at > conversation_reads.last_read_at
        )

      WHERE conversations.is_group = true

      GROUP BY
        conversations.id,
        conversations.group_name,
        conversations.group_avatar,
        conversations.admin_id,
        last_message.text,
        last_message.created_at,
        last_message.sender_id,
        last_message.status,
        last_message.image,
        last_message.video,
        last_message.audio,
        last_message.audio_duration
    ) AS all_conversations

    ORDER BY updated_at DESC
  `, [userId]);

  return result.rows;
}

async function markConversationAsRead(conversationId, userId) {
  await pool.query(
    `
    INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `,
    [conversationId, userId]
  );
}

async function getMessagesByConversation(
  conversationId,
  before = null,
  limit = 30,
  currentUserId = null
) {
  const params = [conversationId];
  let beforeCondition = '';

  if (before) {
    params.push(before);
    beforeCondition = `AND messages.created_at < $${params.length}`;
  }

  params.push(limit);

  const result = await pool.query(`
    SELECT *
    FROM (
      SELECT 
        messages.id,
        messages.text,
        messages.created_at,
        messages.sender_id,
        messages.status,
        users.username,
        users.display_name,
        users.avatar,
        messages.image,
        messages.video,
        messages.audio,
        messages.audio_duration
      FROM messages
      JOIN users ON messages.sender_id = users.id
      WHERE messages.conversation_id = $1
        AND messages.is_deleted = false
        ${beforeCondition}
      ORDER BY messages.created_at DESC
      LIMIT $${params.length}
    ) AS latest_messages
    ORDER BY created_at ASC
  `, params);

  return attachReactionsToMessages(result.rows, currentUserId);
}

async function getMessageById(messageId, currentUserId = null) {
  const result = await pool.query(`
    SELECT 
      messages.id,
      messages.text,
      messages.created_at,
      messages.sender_id,
      messages.status,
      users.username,
      users.display_name,
      users.avatar,
      messages.image,
      messages.video,
      messages.audio,
      messages.audio_duration
    FROM messages
    JOIN users ON messages.sender_id = users.id
    WHERE messages.id = $1
  `, [messageId]);

  const message = result.rows[0];
  if (!message) return message;

  const [messageWithReactions] = await attachReactionsToMessages(
    [message],
    currentUserId
  );

  return messageWithReactions;
}

async function deleteConversationById(conversationId, userId) {
  await pool.query(
    `DELETE FROM conversations
     WHERE id = $1
     AND (user_one_id = $2 OR user_two_id = $2)`,
    [conversationId, userId]
  );
}

async function clearConversationById(conversationId, userId) {
  const result = await pool.query(
    `
    UPDATE messages
    SET is_deleted = true,
        deleted_at = CURRENT_TIMESTAMP,
        text = ''
    WHERE conversation_id = $1
      AND is_deleted = false
      AND EXISTS (
        SELECT 1
        FROM conversations
        WHERE conversations.id = $1
          AND (
            (
              conversations.is_group = false
              AND (
                conversations.user_one_id = $2
                OR conversations.user_two_id = $2
              )
            )
            OR (
              conversations.is_group = true
              AND EXISTS (
                SELECT 1
                FROM conversation_members
                WHERE conversation_members.conversation_id = conversations.id
                  AND conversation_members.user_id = $2
              )
            )
          )
      )
    RETURNING id
    `,
    [conversationId, userId]
  );

  return result.rows;
}

async function updateMessageById(messageId, userId, text) {
  const result = await pool.query(
    `UPDATE messages
     SET text = $1
     WHERE id = $2 AND sender_id = $3
     RETURNING id, conversation_id, sender_id, text, status, created_at`,
    [text, messageId, userId]
  );

  return result.rows[0];
}

async function deleteMessageById(messageId) {
  const result = await pool.query(
    `UPDATE messages
     SET is_deleted = true,
         deleted_at = CURRENT_TIMESTAMP,
         text = 'Message deleted'
     WHERE id = $1
     RETURNING id, conversation_id`,
    [messageId]
  );

  return result.rows[0];
}

async function markMessagesAsRead(conversationId, userId) {
  const result = await pool.query(
    `
    UPDATE messages
    SET status = 'read'
    WHERE conversation_id = $1
      AND sender_id <> $2
      AND is_deleted = false
      AND status <> 'read'
    RETURNING id, conversation_id, sender_id, status
    `,
    [conversationId, userId]
  );

  return result.rows;
}

async function markMessageAsDelivered(messageId) {
  const result = await pool.query(
    `
    UPDATE messages
    SET status = 'delivered'
    WHERE id = $1
      AND status = 'sent'
    RETURNING id, conversation_id, sender_id, status
    `,
    [messageId]
  );

  return result.rows[0];
}

async function markIncomingMessagesAsDelivered(userId) {
  const result = await pool.query(
    `
    UPDATE messages
    SET status = 'delivered'
    FROM conversations
    WHERE messages.conversation_id = conversations.id
      AND messages.status = 'sent'
      AND messages.is_deleted = false
      AND messages.sender_id <> $1
      AND (
        conversations.user_one_id = $1
        OR conversations.user_two_id = $1
      )
    RETURNING 
      messages.id,
      messages.conversation_id,
      messages.sender_id,
      messages.status
    `,
    [userId]
  );

  return result.rows;
}

module.exports = {
  findOrCreateConversation,
  createMessage,
  getUserConversations,
  getMessagesByConversation,
  getMessageById,
  markConversationAsRead,
  deleteConversationById,
  updateMessageById,
  deleteMessageById,
  markMessagesAsRead,
  markMessageAsDelivered,
  markIncomingMessagesAsDelivered,
  clearConversationById,
  getGroupMemberIds,
  getConversationById,
  ensureMessageReactionsTable,
  getMessageReactions,
  setMessageReaction,
};
