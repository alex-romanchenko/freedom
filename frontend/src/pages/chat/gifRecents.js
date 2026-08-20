const RECENT_GIFS_KEY = 'freedom_recent_gifs';

function uniqueGifs(gifs) {
  const seen = new Set();
  return gifs.filter((gif) => {
    if (!gif?.id || !gif?.url || seen.has(gif.id)) return false;
    seen.add(gif.id);
    return true;
  });
}

export function getRecentGifs() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_GIFS_KEY) || '[]');
    return Array.isArray(value) ? uniqueGifs(value).slice(0, 18) : [];
  } catch {
    return [];
  }
}

export function rememberGif(gif) {
  const recents = uniqueGifs([gif, ...getRecentGifs()]).slice(0, 18);
  localStorage.setItem(RECENT_GIFS_KEY, JSON.stringify(recents));
}

export { uniqueGifs };

