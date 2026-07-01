import { useEffect, useState } from 'react';
import { getFavoritePostsApi } from '../api/postsApi';
import PostCard from '../components/PostCard';
import { t } from '../utils/i18n';

function Favorites({ onOpenUser, onPostClick, language }) {
  const [posts, setPosts] = useState([]);

  const loadFavorites = async () => {
    try {
      const data = await getFavoritePostsApi();
      setPosts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  return (
    <div className="page">
      <h1>{t('favorites', language)}</h1>

      {posts.length === 0 && (
        <p className="username">{t('no_favorite_posts', language)}</p>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onUserClick={onOpenUser}
          onPostClick={onPostClick}
          onPostChanged={loadFavorites}
          language={language}
        />
      ))}
    </div>
  );
}

export default Favorites;
