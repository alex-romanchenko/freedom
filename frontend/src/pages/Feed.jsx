import { useEffect, useState } from 'react';
import { getFollowingPostsApi, getMyPostsApi } from '../api/postsApi';
import CreatePostForm from '../components/CreatePostForm';
import PostCard from '../components/PostCard';

function Feed({ onOpenUser, onPostClick }) {
  const [activeTab, setActiveTab] = useState('following');
  const [posts, setPosts] = useState([]);

  const fetchPosts = async () => {
    try {
      const data =
        activeTab === 'my'
          ? await getMyPostsApi()
          : await getFollowingPostsApi();

      setPosts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [activeTab]);

  return (
    <div className="feed-page">
      <div className="feed-tabs">
        <button
          className={activeTab === 'my' ? 'active' : ''}
          onClick={() => setActiveTab('my')}
        >
          My posts
        </button>

        <button
          className={activeTab === 'following' ? 'active' : ''}
          onClick={() => setActiveTab('following')}
        >
          Following
        </button>
      </div>

      <CreatePostForm onPostCreated={fetchPosts} />

      {posts.length === 0 && (
        <p className="empty-text">
          {activeTab === 'my'
            ? 'You have no posts yet'
            : 'No posts from people you follow yet'}
        </p>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onUserClick={onOpenUser}
          onPostClick={onPostClick}
          canManage={activeTab === 'my'}
          onPostChanged={fetchPosts}
        />
      ))}
    </div>
  );
}

export default Feed;