import { useEffect, useState } from 'react';
import { getFavoritePostsApi } from '../api/postsApi';
import PostCard from '../components/PostCard';

function Favorites({ onOpenUser, onPostClick }) {
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
      <h1>Favorites</h1>

      {posts.length === 0 && (
        <p className="username">You have no favorite posts yet</p>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onUserClick={onOpenUser}
          onPostClick={onPostClick}
          onPostChanged={loadFavorites}
        />
      ))}
    </div>
  );
}

export default Favorites;