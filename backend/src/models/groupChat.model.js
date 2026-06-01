const pool = require('../db');

async function createGroupConversation({ name, avatar, adminId, memberIds }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const conversationResult = await client.query(
      `
      INSERT INTO conversations (
        is_group,
        group_name,
        group_avatar,
        admin_id
      )
      VALUES (true, $1, $2, $3)
      RETURNING *
      `,
      [name, avatar || null, adminId]
    );

    const conversation = conversationResult.rows[0];

    const uniqueMemberIds = [...new Set([Number(adminId), ...memberIds.map(Number)])];

    for (const userId of uniqueMemberIds) {
      await client.query(
        `
        INSERT INTO conversation_members (
          conversation_id,
          user_id,
          role
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (conversation_id, user_id) DO NOTHING
        `,
        [
          conversation.id,
          userId,
          Number(userId) === Number(adminId) ? 'admin' : 'member',
        ]
      );
    }

    await client.query('COMMIT');

    return conversation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getGroupInfo(conversationId, currentUserId) {
  const groupResult = await pool.query(
    `
    SELECT 
      conversations.id,
      conversations.group_name,
      conversations.group_avatar,
      conversations.admin_id,
      conversations.created_at
    FROM conversations
    JOIN conversation_members
      ON conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = $2
    WHERE conversations.id = $1
      AND conversations.is_group = true
    `,
    [conversationId, currentUserId]
  );

  const group = groupResult.rows[0];

  if (!group) return null;

  const membersResult = await pool.query(
    `
    SELECT 
      users.id,
      users.username,
      users.display_name,
      users.avatar,
      users.last_seen,
      conversation_members.role,
      conversation_members.joined_at
    FROM conversation_members
    JOIN users ON users.id = conversation_members.user_id
    WHERE conversation_members.conversation_id = $1
    ORDER BY 
      CASE WHEN users.id = $2 THEN 0 ELSE 1 END,
      users.display_name ASC
    `,
    [conversationId, currentUserId]
  );

  return {
    ...group,
    members: membersResult.rows,
  };
}

async function updateGroupName(conversationId, adminId, name) {
  const result = await pool.query(
    `
    UPDATE conversations
    SET group_name = $3
    WHERE id = $1
      AND is_group = true
      AND admin_id = $2
    RETURNING id, group_name, group_avatar, admin_id
    `,
    [conversationId, adminId, name]
  );

  return result.rows[0];
}
async function updateGroupAvatar(conversationId, adminId, avatarPath) {
  const result = await pool.query(
    `
    UPDATE conversations
    SET group_avatar = $3
    WHERE id = $1
      AND is_group = true
      AND admin_id = $2
    RETURNING id, group_name, group_avatar, admin_id
    `,
    [conversationId, adminId, avatarPath]
  );

  return result.rows[0];
}

async function isGroupAdmin(conversationId, userId) {
  const result = await pool.query(
    `
    SELECT id
    FROM conversations
    WHERE id = $1
      AND is_group = true
      AND admin_id = $2
    `,
    [conversationId, userId]
  );

  return Boolean(result.rows[0]);
}

async function addGroupMembers(conversationId, adminId, memberIds) {
  const isAdmin = await isGroupAdmin(conversationId, adminId);

  if (!isAdmin) return null;

  const uniqueMemberIds = [...new Set(memberIds.map(Number))];

  for (const userId of uniqueMemberIds) {
    await pool.query(
      `
      INSERT INTO conversation_members (
        conversation_id,
        user_id,
        role
      )
      VALUES ($1, $2, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING
      `,
      [conversationId, userId]
    );
  }

  return true;
}

async function removeGroupMember(conversationId, adminId, memberId) {
  const isAdmin = await isGroupAdmin(conversationId, adminId);

  if (!isAdmin) return null;

  if (Number(adminId) === Number(memberId)) {
    return false;
  }

  const result = await pool.query(
    `
    DELETE FROM conversation_members
    WHERE conversation_id = $1
      AND user_id = $2
    RETURNING *
    `,
    [conversationId, memberId]
  );

  return result.rows[0];
}

async function leaveGroup(conversationId, userId) {
  const result = await pool.query(
    `
    DELETE FROM conversation_members
    WHERE conversation_id = $1
      AND user_id = $2
      AND user_id NOT IN (
        SELECT admin_id FROM conversations WHERE id = $1
      )
    RETURNING *
    `,
    [conversationId, userId]
  );

  return result.rows[0];
}

async function deleteGroup(conversationId, adminId) {
  const result = await pool.query(
    `
    DELETE FROM conversations
    WHERE id = $1
      AND is_group = true
      AND admin_id = $2
    RETURNING *
    `,
    [conversationId, adminId]
  );

  return result.rows[0];
}

module.exports = {
  createGroupConversation,
  getGroupInfo,
  updateGroupName,
  updateGroupAvatar,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
};