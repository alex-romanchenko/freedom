import { useEffect, useState } from 'react';
import { getPopularPostsApi } from '../api/postsApi';

function PopularPosts({ onOpenUser }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getPopularPostsApi();
        setPosts(data);
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, []);

  return (
    <div className="side-card">
      <h3>Popular posts</h3>

      {posts.map((post) => (
        <div key={post.id} className="popular-post">
          <div
            className="popular-post-user"
            onClick={() => onOpenUser(post.username)}
          >
            {post.avatar ? (
              <img src={`http://localhost:5000${post.avatar}`} alt="" />
            ) : (
              <div className="popular-post-avatar">
                {post.display_name?.[0] || '?'}
              </div>
            )}

            <strong>{post.display_name}</strong>
          </div>

          <p>{post.text}</p>

          {post.image && (
            <img
              className="popular-post-image"
              src={`http://localhost:5000${post.image}`}
              alt=""
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default PopularPosts;