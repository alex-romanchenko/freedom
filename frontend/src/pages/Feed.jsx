import { useEffect, useState } from 'react';
import socket from '../socket';
import { getFollowingPostsApi, getMyPostsApi } from '../api/postsApi';
import CreatePostForm from '../components/CreatePostForm';
import PostCard from '../components/PostCard';

const LIMIT = 20;

function Feed({ onOpenUser, onPostClick }) {
  const [activeTab, setActiveTab] = useState('following');
  const [posts, setPosts] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = async (reset = false) => {
    if (loading) return;

    setLoading(true);

    try {
      const currentOffset = reset ? 0 : offset;

      const data =
        activeTab === 'my'
          ? await getMyPostsApi(LIMIT, currentOffset)
          : await getFollowingPostsApi(LIMIT, currentOffset);

          if (reset) {
            setPosts(data);
          } else {
            setPosts((prev) => {
              const newPosts = data.filter(
                (post) => !prev.some((item) => item.id === post.id)
              );

              return [...prev, ...newPosts];
            });
          }

      setOffset((prev) => reset ? data.length : prev + data.length);
      setHasMore(data.length === LIMIT);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    fetchPosts(true);
  }, [activeTab]);

  useEffect(() => {
    const handleScroll = () => {
      const isBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200;

      if (isBottom && hasMore && !loading) {
        fetchPosts(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, [offset, hasMore, loading, activeTab]);

  useEffect(() => {
    const handleNewPost = (data) => {
      if (activeTab !== 'following') return;

      setPosts((prev) => {
        const exists = prev.some((post) => post.id === data.post.id);

        if (exists) return prev;

        return [data.post, ...prev];
      });

      setOffset((prev) => prev + 1);
    };

    socket.on('newPost', handleNewPost);

    return () => {
      socket.off('newPost', handleNewPost);
    };
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

      <CreatePostForm onPostCreated={() => fetchPosts(true)} />

      {posts.length === 0 && !loading && (
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
          onPostChanged={() => fetchPosts(true)}
        />
      ))}

      {loading && <p className="empty-text">Loading...</p>}

      {!hasMore && posts.length > 0 && (
        <p className="empty-text">No more posts</p>
      )}
    </div>
  );
}

export default Feed;