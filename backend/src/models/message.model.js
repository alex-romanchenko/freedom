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
  file,
  fileName,
  fileMime,
  fileSize,
  mediaSha256,
  videoAspectRatio,
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
      file,
       file_name,
       file_mime,
       file_size,
       media_sha256,
       video_aspect_ratio,
       status
     )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'sent')
    RETURNING
      id,
      conversation_id,
      sender_id,
      text,
      image,
      video,
      audio,
      audio_duration,
      file,
       file_name,
       file_mime,
       file_size,
       media_sha256,
       video_aspect_ratio,
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
      file || null,
      fileName || null,
      fileMime || null,
      fileSize || 0,
      mediaSha256 || null,
      Number.isFinite(videoAspectRatio) && videoAspectRatio > 0
        ? videoAspectRatio
        : null,
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

async function getConversationImages(conversationId, userId) {
  const access = await pool.query(
    `
    SELECT 1
    FROM conversations
    LEFT JOIN conversation_members
      ON conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = $2
    WHERE conversations.id = $1
      AND (
        (conversations.is_group = false AND (
          conversations.user_one_id = $2 OR conversations.user_two_id = $2
        ))
        OR (conversations.is_group = true AND conversation_members.user_id IS NOT NULL)
      )
    `,
    [conversationId, userId]
  );

  if (!access.rowCount) return null;

  const result = await pool.query(
    `
    SELECT id, image, created_at
    FROM messages
    WHERE conversation_id = $1
      AND image IS NOT NULL
      AND image <> ''
      AND is_deleted = false
    ORDER BY created_at ASC, id ASC
    `,
    [conversationId]
  );

  return result.rows;
}

async function getConversationAttachments(conversationId, userId) {
  const result = await pool.query(
    `
    SELECT
      messages.id, messages.image, messages.video, messages.audio,
      messages.file, messages.file_name, messages.file_mime,
      messages.audio_duration, messages.created_at
    FROM messages
    WHERE messages.conversation_id = $1
      AND messages.is_deleted = false
      AND (
        messages.image IS NOT NULL OR messages.video IS NOT NULL
        OR messages.audio IS NOT NULL OR messages.file IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM conversations
        LEFT JOIN conversation_members
          ON conversation_members.conversation_id = conversations.id
          AND conversation_members.user_id = $2
        WHERE conversations.id = $1
          AND (
            (conversations.is_group = false AND (
              conversations.user_one_id = $2 OR conversations.user_two_id = $2
            ))
            OR (conversations.is_group = true AND conversation_members.user_id IS NOT NULL)
          )
      )
    ORDER BY messages.created_at DESC, messages.id DESC
    `,
    [conversationId, userId]
  );

  return result.rows;
}

async function getGroupPushRecipientIds(conversationId) {
  const result = await pool.query(
    `
    SELECT user_id
    FROM conversation_members
    WHERE conversation_id = $1
      AND COALESCE(notifications_muted, false) = false
    `,
    [conversationId]
  );

  return result.rows.map((row) => row.user_id);
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_mentions (
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (message_id, mentioned_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_reaction_notifications (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reaction TEXT NOT NULL,
      seen_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (message_id, recipient_id, actor_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_notification_settings (
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      muted BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (conversation_id, user_id)
    )
  `);
}

async function isConversationNotificationsMuted(conversationId, userId) {
  const result = await pool.query(
    `SELECT muted FROM conversation_notification_settings
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows[0]?.muted === true;
}

async function setConversationNotificationsMuted(conversationId, userId, muted) {
  const result = await pool.query(
    `
    INSERT INTO conversation_notification_settings (conversation_id, user_id, muted)
    SELECT $1, $2, $3
    WHERE EXISTS (
      SELECT 1 FROM conversations
      LEFT JOIN conversation_members
        ON conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = $2
      WHERE conversations.id = $1
        AND (
          (conversations.is_group = false AND (
            conversations.user_one_id = $2 OR conversations.user_two_id = $2
          ))
          OR (conversations.is_group = true AND conversation_members.user_id IS NOT NULL)
        )
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET muted = EXCLUDED.muted
    RETURNING muted
    `,
    [conversationId, userId, muted]
  );
  return result.rows[0]?.muted;
}

async function upsertMessageReactionNotification({
  conversationId,
  messageId,
  recipientId,
  actorId,
  reaction,
}) {
  if (!reaction) {
    await pool.query(
      `DELETE FROM message_reaction_notifications
       WHERE message_id = $1 AND recipient_id = $2 AND actor_id = $3`,
      [messageId, recipientId, actorId]
    );
    return;
  }

  await pool.query(
    `
    INSERT INTO message_reaction_notifications (
      conversation_id, message_id, recipient_id, actor_id, reaction, seen_at
    ) VALUES ($1, $2, $3, $4, $5, NULL)
    ON CONFLICT (message_id, recipient_id, actor_id)
    DO UPDATE SET reaction = EXCLUDED.reaction,
                  seen_at = NULL,
                  created_at = CURRENT_TIMESTAMP
    `,
    [conversationId, messageId, recipientId, actorId, reaction]
  );
}

async function recordGroupMessageMentions({
  messageId,
  conversationId,
  senderId,
  text,
}) {
  const usernames = [...new Set(
    String(text || '')
      // A selected multi-word username contains an invisible separator after
      // each normal space. It looks like "@Dasha Romanchenko" to people but
      // stays an unambiguous mention token for the parser.
      .match(/@[a-zA-Z0-9_]+(?:\s\u200B[a-zA-Z0-9_]+)*/g)
      ?.map((match) => match.slice(1).replaceAll('\u200B', '').toLowerCase()) || []
  )];
  if (!usernames.length) return;
  const mentionEveryone = usernames.includes('all');

  await pool.query(
    `
    INSERT INTO message_mentions (message_id, mentioned_user_id)
    SELECT $1, users.id
    FROM users
    JOIN conversation_members
      ON conversation_members.user_id = users.id
     AND conversation_members.conversation_id = $2
    WHERE users.id <> $3
      AND (
        $4::boolean
        OR LOWER(users.username) = ANY($5::text[])
      )
    ON CONFLICT DO NOTHING
    `,
    [messageId, conversationId, senderId, mentionEveryone, usernames]
  );
}

async function getReactionRows(messageIds, currentUserId = null) {
  if (!messageIds.length) return [];

  const result = await pool.query(
    `
    SELECT
      message_reactions.message_id,
      message_reactions.reaction,
      COUNT(*)::int AS count,
      BOOL_OR(message_reactions.user_id = $2) AS reacted_by_me,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'user_id', users.id,
          'username', users.username,
          'display_name', users.display_name,
          'avatar', users.avatar,
          'created_at', message_reactions.created_at
        )
        ORDER BY message_reactions.created_at
      ) AS users
    FROM message_reactions
    JOIN users ON users.id = message_reactions.user_id
    WHERE message_reactions.message_id = ANY($1::int[])
    GROUP BY message_reactions.message_id, message_reactions.reaction
    ORDER BY MIN(message_reactions.created_at)
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
      users: Array.isArray(row.users) ? row.users : [],
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
    users: Array.isArray(row.users) ? row.users : [],
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
        last_message.file AS last_message_file,
        last_message.file_name AS last_message_file_name,
        last_message.file_mime AS last_message_file_mime,
        last_message.file_size AS last_message_file_size,

        COUNT(unread_messages.id) AS unread_count,
        0::int AS mention_unread_count,
        (
          SELECT JSON_BUILD_OBJECT(
            'reaction', message_reaction_notifications.reaction,
            'actor_name', users.display_name,
            'actor_avatar', users.avatar
          )
          FROM message_reaction_notifications
          JOIN users ON users.id = message_reaction_notifications.actor_id
          WHERE message_reaction_notifications.conversation_id = conversations.id
            AND message_reaction_notifications.recipient_id = $1
            AND message_reaction_notifications.seen_at IS NULL
          ORDER BY message_reaction_notifications.created_at DESC
          LIMIT 1
        ) AS reaction_preview

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
        last_message.audio_duration,
        last_message.file,
        last_message.file_name,
        last_message.file_mime,
        last_message.file_size,
        conversation_reads.last_read_at

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
        last_message.file AS last_message_file,
        last_message.file_name AS last_message_file_name,
        last_message.file_mime AS last_message_file_mime,
        last_message.file_size AS last_message_file_size,

        COUNT(unread_messages.id) AS unread_count,
        (
          SELECT COUNT(*)::int
          FROM message_mentions
          JOIN messages AS mentioned_messages
            ON mentioned_messages.id = message_mentions.message_id
          WHERE message_mentions.mentioned_user_id = $1
            AND mentioned_messages.conversation_id = conversations.id
            AND mentioned_messages.is_deleted = false
            AND mentioned_messages.sender_id <> $1
            AND (
              conversation_reads.last_read_at IS NULL
              OR mentioned_messages.created_at > conversation_reads.last_read_at
            )
        ) AS mention_unread_count,
        (
          SELECT JSON_BUILD_OBJECT(
            'reaction', message_reaction_notifications.reaction,
            'actor_name', users.display_name,
            'actor_avatar', users.avatar
          )
          FROM message_reaction_notifications
          JOIN users ON users.id = message_reaction_notifications.actor_id
          WHERE message_reaction_notifications.conversation_id = conversations.id
            AND message_reaction_notifications.recipient_id = $1
            AND message_reaction_notifications.seen_at IS NULL
          ORDER BY message_reaction_notifications.created_at DESC
          LIMIT 1
        ) AS reaction_preview

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
        last_message.audio_duration,
        last_message.file,
        last_message.file_name,
        last_message.file_mime,
        last_message.file_size,
        conversation_reads.last_read_at
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

  await markReactionNotificationsAsSeen(conversationId, userId);
}

async function getMessagesByConversation(
  conversationId,
  before = null,
  limit = 30,
  currentUserId = null,
  after = null
) {
  const params = [conversationId];
  let dateCondition = '';
  let innerOrder = 'DESC';

  if (before) {
    params.push(before);
    dateCondition = `AND messages.created_at < $${params.length}`;
  } else if (after) {
    params.push(after);
    dateCondition = `AND messages.created_at > $${params.length}`;
    innerOrder = 'ASC';
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
        messages.video_aspect_ratio,
        messages.audio,
        messages.audio_duration,
        messages.file,
        messages.file_name,
        messages.file_mime,
        messages.file_size
      FROM messages
      JOIN users ON messages.sender_id = users.id
      WHERE messages.conversation_id = $1
        AND messages.is_deleted = false
        ${dateCondition}
      ORDER BY messages.created_at ${innerOrder}
      LIMIT $${params.length}
    ) AS latest_messages
    ORDER BY created_at ASC
  `, params);

  return attachReactionsToMessages(result.rows, currentUserId);
}

async function searchMessages(userId, query, limit = 20, offset = 0) {
  const normalizedQuery = `%${query}%`;

  const result = await pool.query(`
    SELECT
      messages.id AS message_id,
      messages.conversation_id,
      messages.text,
      messages.created_at,
      messages.sender_id,
      messages.status,
      conversations.is_group,
      conversations.group_name,
      conversations.group_avatar,
      other_user.id AS user_id,
      other_user.username,
      other_user.display_name,
      other_user.avatar,
      sender.username AS sender_username,
      sender.display_name AS sender_display_name
    FROM messages
    JOIN conversations
      ON conversations.id = messages.conversation_id
    JOIN users AS sender
      ON sender.id = messages.sender_id
    LEFT JOIN users AS other_user
      ON other_user.id = CASE
        WHEN conversations.user_one_id = $1 THEN conversations.user_two_id
        ELSE conversations.user_one_id
      END
      AND conversations.is_group = false
    LEFT JOIN conversation_members
      ON conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = $1
    WHERE messages.is_deleted = false
      AND messages.text ILIKE $2
      AND (
        (
          conversations.is_group = false
          AND (
            conversations.user_one_id = $1
            OR conversations.user_two_id = $1
          )
        )
        OR (
          conversations.is_group = true
          AND conversation_members.user_id IS NOT NULL
        )
      )
    ORDER BY messages.created_at DESC, messages.id DESC
    LIMIT $3 OFFSET $4
  `, [userId, normalizedQuery, limit, offset]);

  return result.rows.map((row) => ({
    messageId: row.message_id,
    conversationId: row.conversation_id,
    text: row.text,
    createdAt: row.created_at,
    senderId: row.sender_id,
    status: row.status,
    isGroup: row.is_group,
    displayName: row.is_group ? row.group_name : row.display_name,
    username: row.is_group ? null : row.username,
    avatar: row.is_group ? row.group_avatar : row.avatar,
    userId: row.is_group ? null : row.user_id,
    senderName: row.sender_display_name || row.sender_username,
  }));
}

async function getMessageById(messageId, currentUserId = null) {
  const result = await pool.query(`
    SELECT 
      messages.id,
      messages.conversation_id,
      messages.text,
      messages.created_at,
      messages.sender_id,
      messages.status,
      users.username,
      users.display_name,
      users.avatar,
      messages.image,
      messages.video,
      messages.video_aspect_ratio,
      messages.audio,
      messages.audio_duration,
      messages.file,
      messages.file_name,
      messages.file_mime,
      messages.file_size
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

async function getForwardableMessageById(messageId, userId) {
  const result = await pool.query(`
    SELECT
      messages.id,
      messages.conversation_id,
      messages.text,
      messages.created_at,
      messages.sender_id,
      messages.status,
      users.username,
      users.display_name,
      users.avatar,
      messages.image,
      messages.video,
      messages.video_aspect_ratio,
      messages.audio,
      messages.audio_duration,
      messages.file,
      messages.file_name,
      messages.file_mime,
      messages.file_size
    FROM messages
    JOIN users ON messages.sender_id = users.id
    JOIN conversations ON conversations.id = messages.conversation_id
    LEFT JOIN conversation_members
      ON conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = $2
    WHERE messages.id = $1
      AND messages.is_deleted = false
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
          AND conversation_members.user_id IS NOT NULL
        )
      )
  `, [messageId, userId]);

  return result.rows[0];
}

async function deleteConversationById(conversationId, userId) {
  await pool.query(
    `DELETE FROM conversations
     WHERE id = $1
     AND (user_one_id = $2 OR user_two_id = $2)`,
    [conversationId, userId]
  );

}

// Unlike regular messages, reactions do not require scrolling to the newest
// message to be considered viewed.  The client calls this as soon as a chat
// is opened, without changing the existing message-read behaviour.
async function markReactionNotificationsAsSeen(conversationId, userId) {
  await pool.query(
    `
    UPDATE message_reaction_notifications
    SET seen_at = CURRENT_TIMESTAMP
    WHERE conversation_id = $1
      AND recipient_id = $2
      AND seen_at IS NULL
    `,
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
  searchMessages,
  getMessageById,
  getForwardableMessageById,
  markConversationAsRead,
  markReactionNotificationsAsSeen,
  deleteConversationById,
  updateMessageById,
  deleteMessageById,
  markMessagesAsRead,
  markMessageAsDelivered,
  markIncomingMessagesAsDelivered,
  clearConversationById,
  getGroupMemberIds,
  getGroupPushRecipientIds,
  getConversationById,
  getConversationImages,
  getConversationAttachments,
  isConversationNotificationsMuted,
  setConversationNotificationsMuted,
  ensureMessageReactionsTable,
  recordGroupMessageMentions,
  upsertMessageReactionNotification,
  getMessageReactions,
  setMessageReaction,
};
