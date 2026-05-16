const pool = require('../db');

async function createEmailToken(userId, token) {
  await pool.query(
    `INSERT INTO email_tokens (user_id, token)
     VALUES ($1, $2)`,
    [userId, token]
  );
}

async function findEmailToken(token) {
  const result = await pool.query(
    `SELECT * FROM email_tokens WHERE token = $1`,
    [token]
  );

  return result.rows[0];
}

async function deleteEmailToken(token) {
  await pool.query(
    `DELETE FROM email_tokens WHERE token = $1`,
    [token]
  );
}

module.exports = {
  createEmailToken,
  findEmailToken,
  deleteEmailToken,
};