const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyGoogleToken } = require('../services/googleToken');

function session(user) {
  return {
    message: 'Login successful',
    token: jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '3650d' }),
    user: {
      id: user.id, username: user.username, email: user.email,
      displayName: user.display_name, avatar: user.avatar,
      headerImage: user.header_image, language: user.language || 'en',
    },
  };
}

// Inject dependencies for tests; production always uses Google's signed-token verifier.
function createGoogleAuth({ db = pool, verify = verifyGoogleToken,
  compare = bcrypt.compare, makeSession = session } = {}) {
  const fail = (res, error) => {
    if (error.code === '23505') return res.status(409).json({
      code: 'ACCOUNT_CONFLICT', message: 'Username, email or Google account is already in use',
    });
    const status = error.status || 500;
    return res.status(status).json({ message: status === 500 ? 'Google authentication failed' : error.message });
  };

  async function googleLogin(req, res) {
    try {
      const body = req.body || {};
      const identity = await verify(body.idToken);
      const linked = await db.query('SELECT * FROM users WHERE google_sub = $1', [identity.sub]);
      if (linked.rows[0]) {
        if (!linked.rows[0].is_verified) return res.status(403).json({ message: 'Please verify your email first' });
        return res.json(makeSession(linked.rows[0]));
      }
      const existing = await db.query('SELECT id FROM users WHERE lower(email) = $1', [identity.email]);
      if (existing.rows.length) return res.status(409).json({
        code: 'GOOGLE_LINK_REQUIRED', message: 'Sign in to your existing account and explicitly link Google',
      });
      // Google may no longer control a non-Gmail/non-Workspace mailbox.
      if (!identity.authoritativeEmail) return res.status(403).json({
        code: 'EMAIL_REGISTRATION_REQUIRED',
        message: 'Register and verify this email through Freedom first, then link Google',
      });
      if (!body.profile) return res.json({
        status: 'registration_required',
        profile: { email: identity.email, suggestedDisplayName: identity.name },
      });
      const { username, displayName, language = 'en', acceptTerms } = body.profile;
      if (typeof username !== 'string' || !/^[A-Za-z]{2,10}$/.test(username) ||
          typeof displayName !== 'string' || !/^[A-Za-zА-Яа-яІіЇїЄєҐґ\s]{2,10}$/.test(displayName) ||
          !displayName.trim() || !['en', 'uk', 'ru'].includes(language) || acceptTerms !== true) {
        return res.status(400).json({ code: 'INVALID_PROFILE',
          message: 'Choose a username (2-10 Latin letters), display name (2-10 letters/spaces), supported language and accept terms' });
      }
      // Unique indexes arbitrate concurrent registration/link attempts atomically.
      const result = await db.query(`INSERT INTO users
        (username, email, password, display_name, language, terms_accepted_at, is_verified, google_sub)
        VALUES ($1, $2, NULL, $3, $4, NOW(), true, $5) RETURNING *`,
      [username, identity.email, displayName.trim(), language, identity.sub]);
      return res.status(201).json(makeSession(result.rows[0]));
    } catch (error) { return fail(res, error); }
  }

  async function linkGoogle(req, res) {
    let connection;
    try {
      const body = req.body || {};
      if (body.confirmLink !== true || typeof body.password !== 'string' ||
          !body.password || Buffer.byteLength(body.password) > 72) {
        return res.status(400).json({ message: 'Explicit confirmation and current password are required' });
      }
      const identity = await verify(body.idToken);
      connection = await db.connect();
      await connection.query('BEGIN');
      const result = await connection.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
      const user = result.rows[0];
      if (!user || !user.is_verified || !user.password || !await compare(body.password, user.password)) {
        throw Object.assign(new Error('Current password or account verification is invalid'), { status: 403 });
      }
      if (user.email.toLowerCase() !== identity.email || (user.google_sub && user.google_sub !== identity.sub)) {
        throw Object.assign(new Error('Google account does not match or another Google account is already linked'), { status: 409 });
      }
      await connection.query('UPDATE users SET google_sub = $1 WHERE id = $2', [identity.sub, user.id]);
      await connection.query('COMMIT');
      return res.json({ message: 'Google account linked successfully' });
    } catch (error) {
      if (connection) await connection.query('ROLLBACK').catch(() => {});
      return fail(res, error);
    } finally { if (connection) connection.release(); }
  }
  return { googleLogin, linkGoogle };
}

module.exports = { ...createGoogleAuth(), createGoogleAuth };
