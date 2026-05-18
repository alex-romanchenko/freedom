const pool = require('../db');

async function followUser(followerId, followingId) {
  await pool.query(
    `INSERT INTO follows (follower_id, following_id, seen_by_following)
      VALUES ($1, $2, false)
      ON CONFLICT DO NOTHING`,
    [followerId, followingId]
  );
}

async function unfollowUser(followerId, followingId) {
  await pool.query(
    `DELETE FROM follows
     WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
}
async function isFollowingUser(followerId, followingId) {
  const result = await pool.query(
    `SELECT id FROM follows
     WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );

  return result.rows.length > 0;
}

async function getMyFriends(userId) {
  const result = await pool.query(`
    SELECT 
      users.id,
      users.username,
      users.display_name,
      users.avatar,
      true AS is_following
    FROM follows
    JOIN users ON follows.following_id = users.id
    WHERE follows.follower_id = $1
    ORDER BY users.display_name
  `, [userId]);

  return result.rows;
}

async function getUserFriendsByUsername(username) {
  const result = await pool.query(`
    SELECT 
      friend.id,
      friend.username,
      friend.display_name,
      friend.avatar
    FROM users
    JOIN follows ON follows.follower_id = users.id
    JOIN users AS friend ON follows.following_id = friend.id
    WHERE users.username = $1
    ORDER BY friend.display_name
  `, [username]);

  return result.rows;
}

async function getIncomingRequests(userId) {
  const result = await pool.query(
    `
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.avatar,
      f.seen_by_following
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = $1
      AND NOT EXISTS (
        SELECT 1
        FROM follows f2
        WHERE f2.follower_id = $1
          AND f2.following_id = f.follower_id
      )
    ORDER BY u.display_name
    `,
    [userId]
  );

  return result.rows;
}

async function markIncomingRequestsSeen(userId) {
  await pool.query(
    `
    UPDATE follows f
    SET seen_by_following = true
    WHERE f.following_id = $1
      AND NOT EXISTS (
        SELECT 1
        FROM follows f2
        WHERE f2.follower_id = $1
          AND f2.following_id = f.follower_id
      )
    `,
    [userId]
  );
}

async function getFollowersIds(userId) {
  const result = await pool.query(
    `
    SELECT follower_id
    FROM follows
    WHERE following_id = $1
    `,
    [userId]
  );

  return result.rows.map((row) => row.follower_id);
}

module.exports = {
  followUser,
  unfollowUser,
  isFollowingUser,
  getMyFriends,
  getUserFriendsByUsername,
  getIncomingRequests,
  markIncomingRequestsSeen,
  getFollowersIds,
};