const express = require('express');
const https = require('https');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';
const cache = new Map();
const cacheTtlMs = 5 * 60 * 1000;

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(`GIPHY returned ${response.statusCode}`));
        }
        try {
          return resolve(JSON.parse(body));
        } catch (_) {
          return reject(new Error('Invalid GIPHY response'));
        }
      });
    });
    request.setTimeout(10000, () => request.destroy(new Error('GIPHY timeout')));
    request.on('error', reject);
  });
}

function mapGif(item) {
  const images = item.images || {};
  const preview = images.fixed_width_small || images.fixed_width || images.original || {};
  const original = images.original || preview;
  // Fixed-width GIFs preserve animation but are much smaller than originals,
  // which makes them practical to download and send as chat media.
  const sendable = images.fixed_width || images.downsized || original;
  return {
    id: item.id,
    title: item.title || '',
    url: sendable.url || original.url,
    previewUrl: preview.webp || preview.url || original.url,
    width: Number(original.width || preview.width || 0),
    height: Number(original.height || preview.height || 0),
  };
}

async function fetchGifs(endpoint, params, res) {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: 'GIF search is not configured' });
  }

  const { limit, offset, ...rest } = params;
  const query = new URLSearchParams({
    api_key: apiKey,
    rating: 'pg-13',
    limit: String(Math.min(Math.max(Number(limit) || 24, 1), 36)),
    offset: String(Math.max(Number(offset) || 0, 0)),
    ...Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value != null && value !== '')
    ),
  });
  const cacheKey = `${endpoint}:${query.toString().replace(`api_key=${encodeURIComponent(apiKey)}&`, '')}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < cacheTtlMs) {
    return res.json(cached.payload);
  }

  try {
    const payload = await getJson(`${GIPHY_BASE_URL}/${endpoint}?${query}`);
    const result = {
      data: (payload.data || []).map(mapGif),
      pagination: payload.pagination || null,
    };
    cache.set(cacheKey, { createdAt: Date.now(), payload: result });
    return res.json(result);
  } catch (error) {
    console.error('GIPHY REQUEST ERROR:', error.message);
    return res.status(502).json({ message: 'GIF search is temporarily unavailable' });
  }
}

router.get('/trending', authMiddleware, (req, res) =>
  fetchGifs(
    'trending',
    { limit: req.query.limit, offset: req.query.offset },
    res
  )
);

router.get('/search', authMiddleware, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ message: 'Search query is required' });
  return fetchGifs(
    'search',
    {
      q,
      limit: req.query.limit,
      offset: req.query.offset,
      lang: req.query.lang || 'en',
    },
    res
  );
});

module.exports = router;
