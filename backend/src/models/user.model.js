const pool = require('../db');

async function createUser({ username, email, password, displayName }) {
  const result = await pool.query(
    `INSERT INTO users (username, email, password, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, display_name, created_at`,
    [username, email, password, displayName]
  );

  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  return result.rows[0];
}

async function findUserByUsername(username) {
  const result = await pool.query(
    `SELECT 
       id,
       username,
       email,
       password,
       display_name AS "displayName",
       avatar,
       header_image AS "headerImage",
       first_name AS "firstName",
       last_name AS "lastName",
       birth_date AS "birthDate",
       city,
       country,
       gender
     FROM users
     WHERE username = $1`,
    [username]
  );

  return result.rows[0];
}

async function getUserById(id) {
  const result = await pool.query(
    `SELECT id, username, email, display_name, avatar, header_image, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0];
}

async function updateUserProfile(userId, data) {
  const {
    username,
    displayName,
    firstName,
    lastName,
    birthDate,
    city,
    country,
    gender,
  } = data;

  const result = await pool.query(
    `UPDATE users
     SET 
       username = $1,
       display_name = $2,
       first_name = $3,
       last_name = $4,
       birth_date = $5,
       city = $6,
       country = $7,
       gender = $8
     WHERE id = $9
     RETURNING 
       id,
       username,
       email,
       display_name AS "displayName",
       avatar,
       header_image AS "headerImage",
       first_name AS "firstName",
       last_name AS "lastName",
       birth_date AS "birthDate",
       city,
       country,
       gender`,
    [
      username,
      displayName,
      firstName,
      lastName,
      birthDate || null,
      city,
      country,
      gender,
      userId,
    ]
  );

  return result.rows[0];
}

async function getUserByUsername(username) {
  const result = await pool.query(
    `SELECT 
       id,
       username,
       email,
       display_name,
       avatar,
       header_image,
       first_name,
       last_name,
       birth_date,
       city,
       country,
       gender
     FROM users
     WHERE username = $1`,
    [username]
  );

  return result.rows[0];
}

async function searchUsers(query, currentUserId) {
  const result = await pool.query(
    `SELECT 
       users.id,
       users.username,
       users.display_name,
       users.avatar,
       CASE 
         WHEN follows.id IS NOT NULL THEN true
         ELSE false
       END AS is_following
     FROM users
     LEFT JOIN follows
       ON follows.following_id = users.id
      AND follows.follower_id = $2
     WHERE 
       (users.username ILIKE $1 OR users.display_name ILIKE $1)
       AND users.id <> $2
     ORDER BY users.username
     LIMIT 20`,
    [`%${query}%`, currentUserId]
  );

  return result.rows;
}

async function updateUserAvatar(id, avatar) {
  const result = await pool.query(
    `UPDATE users
     SET avatar = $1
     WHERE id = $2
     RETURNING id, username, email, display_name, avatar, header_image, created_at`,
    [avatar, id]
  );

  return result.rows[0];
}

async function updateUserHeaderImage(id, headerImage) {
  const result = await pool.query(
    `UPDATE users
     SET header_image = $1
     WHERE id = $2
     RETURNING id, username, email, display_name, avatar, header_image, created_at`,
    [headerImage, id]
  );

  return result.rows[0];
}

async function getUsersForFollow(currentUserId) {
  const result = await pool.query(`
    SELECT 
      users.id,
      users.username,
      users.display_name,
      users.avatar,
      CASE 
        WHEN follows.id IS NOT NULL THEN true
        ELSE false
      END AS is_following
    FROM users
    LEFT JOIN follows
      ON follows.following_id = users.id
     AND follows.follower_id = $1
    WHERE users.id != $1
    ORDER BY users.created_at DESC
    LIMIT 5
  `, [currentUserId]);

  return result.rows;
}

async function saveFcmToken(userId, token, platform = 'android') {
  const result = await pool.query(
    `
    INSERT INTO user_fcm_tokens (user_id, token, platform, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      platform = EXCLUDED.platform,
      updated_at = NOW()
    RETURNING id, user_id, token, platform, updated_at
    `,
    [userId, token, platform]
  );

  return result.rows[0];
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserByUsername,
  getUserById,
  updateUserProfile,
  searchUsers,
  updateUserAvatar,
  updateUserHeaderImage,
  getUsersForFollow,
  saveFcmToken,
};