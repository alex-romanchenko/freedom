const pool = require('../db');

async function createPasswordToken(userId, token) {
  await pool.query(
    `INSERT INTO password_tokens (user_id, token)
     VALUES ($1, $2)`,
    [userId, token]
  );
}

async function findPasswordToken(token) {
  const result = await pool.query(
    `SELECT * FROM password_tokens WHERE token = $1`,
    [token]
  );

  return result.rows[0];
}

async function deletePasswordToken(token) {
  await pool.query(
    `DELETE FROM password_tokens WHERE token = $1`,
    [token]
  );
}

module.exports = {
  createPasswordToken,
  findPasswordToken,
  deletePasswordToken,
};