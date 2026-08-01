const pool = require('../db');

async function hasAcceptedTerms(userId) {
  const result = await pool.query(
    'SELECT terms_accepted_at FROM users WHERE id = $1',
    [userId]
  );
  return Boolean(result.rows[0]?.terms_accepted_at);
}

async function acceptTerms(userId) {
  const result = await pool.query(
    `UPDATE users
     SET terms_accepted_at = COALESCE(terms_accepted_at, NOW())
     WHERE id = $1
     RETURNING terms_accepted_at`,
    [userId]
  );
  return result.rows[0];
}

async function areUsersBlocked(firstUserId, secondUserId) {
  const result = await pool.query(
    `SELECT 1
     FROM user_blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [firstUserId, secondUserId]
  );
  return result.rowCount > 0;
}

async function getBlockRelationship(currentUserId, otherUserId) {
  const result = await pool.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM user_blocks
         WHERE blocker_id = $1 AND blocked_id = $2
       ) AS blocked_by_me,
       EXISTS (
         SELECT 1 FROM user_blocks
         WHERE blocker_id = $2 AND blocked_id = $1
       ) AS blocked_me`,
    [currentUserId, otherUserId]
  );
  return {
    blockedByMe: result.rows[0]?.blocked_by_me === true,
    blockedMe: result.rows[0]?.blocked_me === true,
  };
}

async function blockUser(blockerId, blockedId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId]
    );
    await client.query(
      `DELETE FROM follows
       WHERE (follower_id = $1 AND following_id = $2)
          OR (follower_id = $2 AND following_id = $1)`,
      [blockerId, blockedId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function unblockUser(blockerId, blockedId) {
  await pool.query(
    'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
    [blockerId, blockedId]
  );
}

async function getBlockedUsers(blockerId) {
  const result = await pool.query(
    `SELECT u.id, u.username, u.display_name, u.avatar, b.created_at
     FROM user_blocks b
     JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC`,
    [blockerId]
  );
  return result.rows;
}

async function createReport({
  reporterId,
  reportedUserId,
  entityType,
  entityId,
  reason,
  details,
}) {
  const recent = await pool.query(
    `SELECT id
     FROM content_reports
     WHERE reporter_id = $1
       AND entity_type = $2
       AND entity_id IS NOT DISTINCT FROM $3
       AND created_at > NOW() - INTERVAL '10 minutes'
     LIMIT 1`,
    [reporterId, entityType, entityId || null]
  );
  if (recent.rowCount > 0) return recent.rows[0];

  const result = await pool.query(
    `INSERT INTO content_reports
      (reporter_id, reported_user_id, entity_type, entity_id, reason, details)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, status, created_at`,
    [
      reporterId,
      reportedUserId || null,
      entityType,
      entityId || null,
      reason,
      details || null,
    ]
  );
  return result.rows[0];
}

async function createAccountDeletionRequest({ email, username, details }) {
  const result = await pool.query(
    `INSERT INTO account_deletion_requests (email, username, details)
     VALUES ($1, $2, $3)
     RETURNING id, status, created_at`,
    [email.toLowerCase(), username || null, details || null]
  );
  return result.rows[0];
}

module.exports = {
  hasAcceptedTerms,
  acceptTerms,
  areUsersBlocked,
  getBlockRelationship,
  blockUser,
  unblockUser,
  getBlockedUsers,
  createReport,
  createAccountDeletionRequest,
};
