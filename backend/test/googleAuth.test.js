const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleAuth } = require('../src/controllers/googleAuth.controller');
const { verifyGoogleToken } = require('../src/services/googleToken');
const guard = require('../src/middleware/googleAuthGuard');
const { createGoogleTokenVerifier } = require('../src/services/googleToken');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { generateKeyPairSync } = require('node:crypto');

const identity = { sub: 'google-123', email: 'person@gmail.com', name: 'Long Google Name', authoritativeEmail: true };
const user = { id: 7, username: 'Person', email: identity.email, password: 'hash', is_verified: true };
const profile = { username: 'Person', acceptTerms: true };
function response() {
  return { statusCode: 200, status(n) { this.statusCode = n; return this; },
    json(body) { this.body = body; return this; }, set() {}, sendStatus(n) { this.statusCode = n; } };
}
function setup(rows = [], options = {}) {
  const queries = [];
  let released = false;
  const db = {
    async query(sql, args) {
      queries.push({ sql, args });
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return {};
      const value = rows.shift();
      if (value instanceof Error) throw value;
      return { rows: value || [] };
    },
    async connect() { return this; }, release() { released = true; },
  };
  return { ...createGoogleAuth({ db, verify: async () => identity, compare: async () => true,
    makeSession: value => ({ token: 'session', user: value }), ...options }),
  queries, get released() { return released; } };
}

test('invalid token cannot access database', async () => {
  const h = setup([], { verify: async () => { throw Object.assign(new Error('Invalid token'), { status: 401 }); } });
  const res = response(); await h.googleLogin({ body: { idToken: 'bad' } }, res);
  assert.equal(res.statusCode, 401); assert.equal(h.queries.length, 0);
});
test('linked subject logs into existing account even if Google email changed', async () => {
  const h = setup([[{ ...user, email: 'old@gmail.com' }]]); const res = response();
  await h.googleLogin({ body: {} }, res);
  assert.equal(res.body.token, 'session'); assert.equal(h.queries.length, 1);
});
test('unverified linked user is denied', async () => {
  const h = setup([[{ ...user, is_verified: false }]]); const res = response();
  await h.googleLogin({ body: {} }, res); assert.equal(res.statusCode, 403);
});
test('same email never auto-links or issues session', async () => {
  const h = setup([[], [user]]); const res = response();
  await h.googleLogin({ body: { profile } }, res);
  assert.equal(res.body.code, 'GOOGLE_LINK_REQUIRED'); assert.equal(h.queries.length, 2);
});
test('new user must choose a Freedom username', async () => {
  const h = setup([[], []]); const res = response(); await h.googleLogin({ body: {} }, res);
  assert.equal(res.body.status, 'registration_required'); assert.equal(h.queries.length, 2);
});
test('non-authoritative email requires Freedom email verification', async () => {
  const h = setup([[], []], { verify: async () => ({ ...identity, authoritativeEmail: false }) });
  const res = response(); await h.googleLogin({ body: { profile } }, res);
  assert.equal(res.body.code, 'EMAIL_REGISTRATION_REQUIRED');
});
for (const invalid of [{ ...profile, acceptTerms: false }, { ...profile, username: 'x1' },
  { ...profile, language: 'xx' }]) {
  test(`invalid profile rejected: ${JSON.stringify(invalid)}`, async () => {
    const h = setup([[], []]); const res = response();
    await h.googleLogin({ body: { profile: invalid } }, res);
    assert.equal(res.statusCode, 400); assert.equal(h.queries.length, 2);
  });
}
test('new Google user gets verified email, no password, accepted terms', async () => {
  const h = setup([[], [], [user]]); const res = response();
  await h.googleLogin({ body: { profile, email: 'attacker@example.com' } }, res);
  assert.equal(res.statusCode, 201); assert.equal(h.queries[2].args[1], identity.email);
  assert.equal(h.queries[2].args[2], profile.username);
  assert.match(h.queries[2].sql, /NULL/); assert.match(h.queries[2].sql, /NOW\(\), true/);
});
test('unique index race returns conflict, not internal details', async () => {
  const h = setup([[], [], Object.assign(new Error('secret SQL'), { code: '23505' })]);
  const res = response(); await h.googleLogin({ body: { profile } }, res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'ACCOUNT_CONFLICT');
});
test('link requires explicit confirmation', async () => {
  const h = setup(); const res = response(); await h.linkGoogle({ body: {}, user }, res);
  assert.equal(res.statusCode, 400); assert.equal(h.queries.length, 0);
});
for (const [label, record, compare] of [
  ['wrong password', user, async () => false],
  ['email mismatch', { ...user, email: 'other@gmail.com' }, async () => true],
  ['different Google link', { ...user, google_sub: 'other-sub' }, async () => true],
  ['unverified account', { ...user, is_verified: false }, async () => true],
]) {
  test(`link refuses ${label} and rolls back`, async () => {
    const h = setup([[record]], { compare }); const res = response();
    await h.linkGoogle({ body: { password: 'secret', confirmLink: true }, user }, res);
    assert.ok([403, 409].includes(res.statusCode));
    assert.equal(h.queries.at(-1).sql, 'ROLLBACK'); assert.equal(h.released, true);
  });
}
test('link locks user and commits without replacing profile/password', async () => {
  const h = setup([[user], []]); const res = response();
  await h.linkGoogle({ body: { password: 'secret', confirmLink: true }, user }, res);
  assert.equal(res.statusCode, 200); assert.match(h.queries[1].sql, /FOR UPDATE/);
  assert.equal(h.queries[2].sql, 'UPDATE users SET google_sub = $1 WHERE id = $2');
  assert.equal(h.queries.at(-1).sql, 'COMMIT'); assert.equal(h.released, true);
});
test('real verifier fails closed for missing config and malformed JWT', async () => {
  const previous = process.env.GOOGLE_WEB_CLIENT_ID; const secret = process.env.JWT_SECRET;
  try {
    delete process.env.GOOGLE_WEB_CLIENT_ID;
    await assert.rejects(verifyGoogleToken('bad'), { status: 503 });
    process.env.GOOGLE_WEB_CLIENT_ID = 'test.apps.googleusercontent.com'; process.env.JWT_SECRET = 'test';
    await assert.rejects(verifyGoogleToken(null), { status: 400 });
    await assert.rejects(verifyGoogleToken('bad'), { status: 401 });
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_WEB_CLIENT_ID; else process.env.GOOGLE_WEB_CLIENT_ID = previous;
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
  }
});
test('guard rejects cross-origin and form submissions; limits repeated JSON requests', () => {
  const req = { is: () => true, get: () => 'https://attacker.invalid', ip: 'test-ip' };
  const cross = response(); guard(req, cross, () => assert.fail()); assert.equal(cross.statusCode, 403);
  const form = response(); guard({ ...req, is: () => false }, form, () => assert.fail()); assert.equal(form.statusCode, 415);
  req.get = () => undefined;
  for (let i = 0; i < 20; i++) guard(req, response(), () => {});
  const limited = response(); guard(req, limited, () => assert.fail()); assert.equal(limited.statusCode, 429);
});

test('Google library verifies signature, issuer, audience, expiry and verified-email claims offline', async () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const client = new OAuth2Client();
  client.getFederatedSignonCertsAsync = async () => ({
    certs: { test: keys.publicKey.export({ type: 'spki', format: 'pem' }) },
  });
  const verify = createGoogleTokenVerifier(client);
  const previous = process.env.GOOGLE_WEB_CLIENT_ID; const secret = process.env.JWT_SECRET;
  process.env.GOOGLE_WEB_CLIENT_ID = 'our-client'; process.env.JWT_SECRET = 'test';
  const now = Math.floor(Date.now() / 1000);
  const claims = { sub: '123', email: 'person@gmail.com', email_verified: true,
    aud: 'our-client', iss: 'https://accounts.google.com', iat: now, exp: now + 3600 };
  const sign = (payload, key = keys.privateKey) => jwt.sign(payload, key,
    { algorithm: 'RS256', keyid: 'test' });
  try {
    assert.equal((await verify(sign(claims))).sub, '123');
    for (const change of [{ aud: 'attacker-client' }, { iss: 'https://attacker.invalid' },
      { iat: now - 7200, exp: now - 3600 }, { email_verified: false }, { sub: '' }]) {
      await assert.rejects(verify(sign({ ...claims, ...change })), { status: 401 });
    }
    const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await assert.rejects(verify(sign(claims, wrongKey)), { status: 401 });
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_WEB_CLIENT_ID; else process.env.GOOGLE_WEB_CLIENT_ID = previous;
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
  }
});
