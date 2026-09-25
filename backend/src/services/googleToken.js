const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();

function createGoogleTokenVerifier(verifier = client) {
  return async function verifyGoogleToken(idToken) {
    const audience = process.env.GOOGLE_WEB_CLIENT_ID;
    if (!audience || !process.env.JWT_SECRET) {
      throw Object.assign(new Error('Google login is not configured'), { status: 503 });
    }
    if (typeof idToken !== 'string' || !idToken || idToken.length > 12000) {
      throw Object.assign(new Error('Google ID token is required'), { status: 400 });
    }
    try {
      const ticket = await verifier.verifyIdToken({ idToken, audience });
      const p = ticket.getPayload();
      if (!p || typeof p.sub !== 'string' || !p.sub ||
          p.email_verified !== true || typeof p.email !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw new Error('Invalid claims');
      return {
        sub: p.sub, email: p.email.toLowerCase(), name: p.name || '',
        authoritativeEmail: p.email.toLowerCase().endsWith('@gmail.com') || !!p.hd,
      };
    } catch {
      throw Object.assign(new Error('Invalid or expired Google ID token'), { status: 401 });
    }
  };
}

module.exports = { verifyGoogleToken: createGoogleTokenVerifier(), createGoogleTokenVerifier };
