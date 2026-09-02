const bcrypt = require('bcrypt');
const readline = require('readline');
const pool = require('../src/db');

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('An interactive terminal is required to enter the password');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = Boolean(process.stdin.isRaw);

    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
    };

    const onData = (chunk) => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Password reset cancelled'));
          return;
        }

        if (byte === 13 || byte === 10) {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }

        if (byte === 8 || byte === 127) {
          value = value.slice(0, -1);
          continue;
        }

        if (byte >= 32 && byte <= 126) {
          value += String.fromCharCode(byte);
        }
      }
    };

    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function findUser(identifier) {
  if (/^\d+$/.test(identifier)) {
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [Number(identifier)]
    );
    return result.rows[0];
  }

  const column = identifier.includes('@') ? 'email' : 'username';
  const result = await pool.query(
    `SELECT id, username, email
     FROM users
     WHERE LOWER(${column}) = LOWER($1)`,
    [identifier]
  );
  return result.rows[0];
}

async function main() {
  const identifier = String(process.argv[2] || '').trim();
  if (!identifier) {
    throw new Error(
      'Usage: npm run reset-password -- <user-id|username|email>'
    );
  }

  const user = await findUser(identifier);
  if (!user) {
    throw new Error(`User not found: ${identifier}`);
  }

  console.log(
    `Found user: id=${user.id}, username=${user.username}, email=${user.email}`
  );
  const confirmation = await ask('Reset this user password? Type YES: ');
  if (confirmation !== 'YES') {
    console.log('Password reset cancelled');
    return;
  }

  const password = await askHidden('New password: ');
  const repeatedPassword = await askHidden('Repeat new password: ');

  if (password !== repeatedPassword) {
    throw new Error('Passwords do not match');
  }
  if (password.length < 6 || /\s/.test(password)) {
    throw new Error(
      'Password must contain at least 6 characters and no whitespace'
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [
      passwordHash,
      user.id,
    ]);
    await client.query('DELETE FROM password_tokens WHERE user_id = $1', [
      user.id,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  console.log(`Password reset completed for user id=${user.id}`);
}

main()
  .catch((error) => {
    console.error(`Password reset failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
