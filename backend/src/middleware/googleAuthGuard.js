// Per-process backstop. For multiple workers use a shared reverse-proxy rate limit too.
const attempts = new Map();
const windowMs = 60 * 1000;
const timer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
}, windowMs);
timer.unref();

function googleAuthGuard(req, res, next) {
  // Only the JS callback JSON flow is supported, not GIS form POST/redirect mode.
  if (!req.is('application/json')) return res.status(415).json({ message: 'JSON is required' });
  const origin = req.get('origin');
  const allowed = (process.env.GOOGLE_ALLOWED_ORIGINS || process.env.CLIENT_URL || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  if (origin && !allowed.includes(origin)) return res.status(403).json({ message: 'Origin not allowed' });
  const key = req.ip;
  const now = Date.now();
  let item = attempts.get(key);
  if (!item || item.until <= now) {
    if (attempts.size >= 10000 && !attempts.has(key)) return res.sendStatus(429);
    item = { count: 0, until: now + windowMs };
    attempts.set(key, item);
  }
  if (++item.count > 20) {
    res.set('Retry-After', String(Math.ceil((item.until - now) / 1000)));
    return res.status(429).json({ message: 'Too many attempts. Try again later' });
  }
  next();
}

module.exports = googleAuthGuard;
