import { useCallback, useEffect, useRef, useState } from 'react';
import { FiSearch, FiSmile, FiX } from 'react-icons/fi';
import api from '../../api/api';
import { getRecentGifs, uniqueGifs } from './gifRecents';

const PAGE_SIZE = 24;

function stringsFor(language) {
  if (language === 'ru') {
    return {
      search: 'Поиск GIF',
      empty: 'GIF не найдены',
      error: 'Не удалось загрузить GIF',
      emoji: 'Эмодзи',
    };
  }
  if (language === 'uk') {
    return {
      search: 'Пошук GIF',
      empty: 'GIF не знайдено',
      error: 'Не вдалося завантажити GIF',
      emoji: 'Емодзі',
    };
  }
  return {
    search: 'Search GIFs',
    empty: 'No GIFs found',
    error: 'Could not load GIFs',
    emoji: 'Emoji',
  };
}

export function GifIcon() {
  return <span className="gif-tab-icon" aria-hidden="true">GIF</span>;
}

function GifGrid({ language, onSelect, expanded = false, onClose }) {
  const strings = stringsFor(language);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);
  const requestRef = useRef(0);

  const loadPage = useCallback(async ({ reset = false, search = query } = {}) => {
    if (loadingRef.current || (!reset && !hasMore)) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');

    const pageOffset = reset ? 0 : offset;
    const requestId = reset ? ++requestRef.current : requestRef.current;

    try {
      const trimmed = search.trim();
      const response = await api.get(trimmed ? '/gifs/search' : '/gifs/trending', {
        params: {
          ...(trimmed ? { q: trimmed, lang: language || 'en' } : {}),
          limit: PAGE_SIZE,
          offset: pageOffset,
        },
      });
      if (requestId !== requestRef.current) return;

      const page = Array.isArray(response.data?.data) ? response.data.data : [];
      const pagination = response.data?.pagination;
      const nextOffset = pageOffset + page.length;
      const total = Number(pagination?.total_count || 0);
      const more = page.length === PAGE_SIZE && (!total || nextOffset < total);
      const recents = reset && !trimmed ? getRecentGifs() : [];

      setGifs((current) =>
        uniqueGifs(reset ? [...recents, ...page] : [...current, ...page])
      );
      setOffset(nextOffset);
      setHasMore(more);
    } catch {
      if (requestId === requestRef.current) {
        if (reset) setGifs([]);
        setError(strings.error);
        setHasMore(false);
      }
    } finally {
      if (requestId === requestRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [hasMore, language, offset, query, strings.error]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadingRef.current = false;
      setOffset(0);
      setHasMore(true);
      loadPage({ reset: true, search: query });
    }, query ? 350 : 0);
    return () => window.clearTimeout(timer);
    // loadPage deliberately restarts only when the search text/language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, language]);

  const handleScroll = (event) => {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 220) {
      loadPage();
    }
  };

  return (
    <div className={`gif-picker-content ${expanded ? 'expanded' : ''}`}>
      {expanded && (
        <div className="gif-search-topbar">
          <button type="button" onClick={onClose} aria-label="Close"><FiX /></button>
          <label className="gif-search-input">
            <FiSearch />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={strings.search}
            />
          </label>
        </div>
      )}

      <div className="gif-grid-scroll custom-scroll" onScroll={handleScroll}>
        <div className="gif-grid">
          {gifs.map((gif) => (
            <button
              type="button"
              key={gif.id}
              className="gif-grid-item"
              title={gif.title || 'GIF'}
              onClick={() => onSelect(gif)}
            >
              <img src={gif.previewUrl || gif.url} alt={gif.title || 'GIF'} loading="lazy" />
            </button>
          ))}
        </div>
        {loading && <div className="gif-picker-state"><span className="gif-spinner" /></div>}
        {!loading && error && <div className="gif-picker-state">{error}</div>}
        {!loading && !error && gifs.length === 0 && (
          <div className="gif-picker-state">{strings.empty}</div>
        )}
        <div className="giphy-attribution">Powered by GIPHY</div>
      </div>
    </div>
  );
}

export function CompactGifPicker({ language, onSelect, onExpandSearch, onEmojiTab }) {
  return (
    <div className="compact-gif-picker">
      <GifGrid language={language} onSelect={onSelect} />
      <div className="chat-picker-tabs">
        <button type="button" onClick={onExpandSearch} aria-label="Search GIFs">
          <FiSearch />
        </button>
        <button type="button" onClick={onEmojiTab} aria-label="Emoji">
          <FiSmile />
        </button>
        <button type="button" className="active" aria-label="GIF">
          <GifIcon />
        </button>
      </div>
    </div>
  );
}

export function GifSearchPanel({ language, onSelect, onClose }) {
  return (
    <aside className="gif-search-panel">
      <GifGrid language={language} onSelect={onSelect} expanded onClose={onClose} />
    </aside>
  );
}
