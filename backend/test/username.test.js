const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidUsername } = require('../src/utils/username');
const pool = require('../src/db');
const { findUserByEmail, findUserByUsername } = require('../src/models/user.model');

test('username accepts 3-15 Latin characters with optional digits', () => {
  for (const value of ['Alex', 'alex', 'Alex2026', 'Ab3', '123', 'FifteenChars123']) {
    assert.equal(isValidUsername(value), true, value);
  }
});

test('username rejects invalid length and punctuation', () => {
  for (const value of ['Al', 'Alex_1', 'Alex.1', 'Alex 1', 'SixteenChars1234', '', null]) {
    assert.equal(isValidUsername(value), false, String(value));
  }
});

test('username and email account lookups are case-insensitive', async () => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql, args) => {
    statements.push({ sql, args });
    return { rows: [] };
  };
  try {
    await findUserByUsername('aLeX2026');
    await findUserByEmail('Person@Gmail.com');
  } finally {
    pool.query = originalQuery;
  }
  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /lower\(username\) = lower\(\$1\)/);
  assert.match(statements[1].sql, /lower\(email\) = lower\(\$1\)/);
});
