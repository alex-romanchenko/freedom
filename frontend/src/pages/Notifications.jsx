import { useEffect, useState } from 'react';
import socket from '../socket';
import {
  getNotificationsApi,
  markNotificationsReadApi,
  deleteNotificationApi,
} from '../api/notificationsApi';
import { getFileUrl } from '../api/fileUrl';

const LIMIT = 20;

function Notifications({ onOpenUser, onOpenPost, onOpenPhoto }) {
  const [notifications, setNotifications] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadNotifications = async (reset = false) => {
    if (loading) return;

    setLoading(true);

    try {
      const currentOffset = reset ? 0 : offset;
      const data = await getNotificationsApi(LIMIT, currentOffset);

      if (reset) {
        setNotifications(data);
      } else {
        setNotifications((prev) => [...prev, ...data]);
      }

      setOffset(currentOffset + data.length);
      setHasMore(data.length === LIMIT);

      if (reset) {
        await markNotificationsReadApi();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(true);
  }, []);

  useEffect(() => {
    const handleNewNotification = () => {
      setOffset(0);
      setHasMore(true);
      loadNotifications(true);
    };

    socket.on('newLike', handleNewNotification);
    socket.on('newComment', handleNewNotification);
    socket.on('newFriendRequest', handleNewNotification);
    socket.on('newPost', handleNewNotification);
    socket.on('newFriendRequestAccepted', handleNewNotification);

    return () => {
      socket.off('newLike', handleNewNotification);
      socket.off('newComment', handleNewNotification);
      socket.off('newFriendRequest', handleNewNotification);
      socket.off('newPost', handleNewNotification);
      socket.off('newFriendRequestAccepted', handleNewNotification);
    };
  }, [offset, loading]);

  useEffect(() => {
    const handleScroll = () => {
      const isBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200;

      if (isBottom && hasMore && !loading) {
        loadNotifications(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, [offset, hasMore, loading]);

  const removeNotification = async (id) => {
    await deleteNotificationApi(id);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

    return `${Math.floor(diff / 86400)}d ago`;
  };

const getText = (item) => {
  if (item.type === 'friend_request') return 'sent you a friend request';

  if (item.type === 'friend_request_accepted') {
    return 'accepted your friend request';
  }

  if (item.type === 'new_post') return `added a new post: ${item.text}`;
  if (item.type === 'like_post') return 'liked your post';
  if (item.type === 'like_photo') return 'liked your photo';
  if (item.type === 'comment_post') return `commented on your post: ${item.text}`;
  if (item.type === 'comment_photo') return `commented on your photo: ${item.text}`;

  return 'sent you a notification';
};

  const openNotification = (item) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id ? { ...n, is_read: true } : n
      )
    );

    if (item.type === 'friend_request') {
      onOpenUser(item.username);
      return;
    }

    if (item.entity_type === 'post') {
      onOpenPost(item.entity_id);
      return;
    }

    if (item.entity_type === 'photo') {
      onOpenPhoto(item.entity_id);
    }
  };

  return (
    <div className="page">
      <h2>Notifications</h2>

      {notifications.length === 0 && !loading && (
        <p className="username">No notifications yet</p>
      )}

      <div className="notifications-list">
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`notification-card ${!item.is_read ? 'unread' : ''}`}
          >
            <div
              className="notification-main"
              onClick={() => openNotification(item)}
            >
              {item.avatar ? (
                <img
                  className="notification-avatar"
                  src={getFileUrl(item.avatar)}
                  alt=""
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenUser(item.username);
                  }}
                />
              ) : (
                <div
                  className="notification-placeholder"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenUser(item.username);
                  }}
                >
                  {item.display_name?.[0] || '?'}
                </div>
              )}

              <div className="notification-content">
                <p>
                  <strong
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenUser(item.username);
                    }}
                  >
                    {item.display_name}
                  </strong>{' '}
                  {getText(item)}
                </p>

                <span>{formatTime(item.created_at)}</span>
              </div>
            </div>

            <button
              className="notification-remove"
              onClick={() => removeNotification(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {loading && <p className="username">Loading...</p>}

      {!hasMore && notifications.length > 0 && (
        <p className="username">No more notifications</p>
      )}
    </div>
  );
}

export default Notifications;