import { useEffect, useState } from 'react';
import socket from '../socket';
import {
  getNotificationsApi,
  markNotificationsReadApi,
  deleteNotificationApi,
} from '../api/notificationsApi';
import { getFileUrl } from '../api/fileUrl';
import { t } from '../utils/i18n';

const LIMIT = 20;

function Notifications({ onOpenUser, onOpenPost, onOpenPhoto, onOpenGroupChat, language }) {
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
    socket.on('groupAdded', handleNewNotification);
    socket.on('groupRemoved', handleNewNotification);

    return () => {
      socket.off('newLike', handleNewNotification);
      socket.off('newComment', handleNewNotification);
      socket.off('newFriendRequest', handleNewNotification);
      socket.off('newPost', handleNewNotification);
      socket.off('newFriendRequestAccepted', handleNewNotification);
      socket.off('groupAdded', handleNewNotification);
      socket.off('groupRemoved', handleNewNotification);
    };
  }, [offset, loading]);

  useEffect(() => {
    const handleScroll = () => {
      const isBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;

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

    if (diff < 60) return `${diff}${t('seconds_ago', language)}`;
    if (diff < 3600) return `${Math.floor(diff / 60)}${t('minutes_ago', language)}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${t('hours_ago', language)}`;

    return `${Math.floor(diff / 86400)}${t('days_ago', language)}`;
  };

  const getText = (item) => {
    if (item.type === 'friend_request') return t('sent_friend_request', language);

    if (item.type === 'friend_request_accepted') {
      return t('accepted_friend_request', language);
    }

    if (item.type === 'new_post') return `${t('added_new_post', language)}: ${item.text}`;
    if (item.type === 'like_post') return t('liked_your_post', language);
    if (item.type === 'like_photo') return t('liked_your_photo', language);
    if (item.type === 'comment_post') {
      return `${t('commented_on_post', language)}: ${item.text}`;
    }
    if (item.type === 'comment_photo') {
      return `${t('commented_on_photo', language)}: ${item.text}`;
    }

    if (item.type === 'group_added') return t('added_to_group', language);
    if (item.type === 'group_removed') return t('removed_from_group', language);

    return t('sent_notification', language);
  };

  const truncateDesktopText = (text, limit = 100) => {
    const normalized = String(text || '').trim();
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit).trimEnd()}…`;
  };

  const openNotification = (item) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
    );

    if (item.type === 'friend_request') {
      onOpenUser(item.username);
      return;
    }

    if (item.entity_type === 'conversation') {
      onOpenGroupChat?.(item.entity_id);
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

  const handleAvatarClick = (e, item) => {
    e.stopPropagation();

    if (item.entity_type === 'conversation') {
      onOpenGroupChat?.(item.entity_id);
      return;
    }

    onOpenUser(item.username);
  };

  return (
    <div className="page">
      <h2>{t('notifications', language)}</h2>

      {notifications.length === 0 && !loading && (
        <p className="username">{t('no_notifications', language)}</p>
      )}

      <div className="notifications-list">
        {notifications.map((item) => {
          const isGroup = item.entity_type === 'conversation';

          const avatar = isGroup ? item.group_avatar : item.avatar;
          const name = isGroup ? item.group_name : item.display_name;
          const placeholder = name?.[0] || '?';
          const notificationText = getText(item);

          return (
            <div
              key={item.id}
              className={`notification-card ${!item.is_read ? 'unread' : ''}`}
            >
              <div
                className="notification-main"
                onClick={() => openNotification(item)}
              >
                {avatar ? (
                  <img
                    className="notification-avatar"
                    src={getFileUrl(avatar)}
                    alt=""
                    onClick={(e) => handleAvatarClick(e, item)}
                  />
                ) : (
                  <div
                    className="notification-placeholder"
                    onClick={(e) => handleAvatarClick(e, item)}
                  >
                    {placeholder}
                  </div>
                )}

                <div className="notification-content">
                  <p>
                    <strong onClick={(e) => handleAvatarClick(e, item)}>
                      {name}
                    </strong>{' '}
                    <span className="notification-text notification-text-desktop">
                      {truncateDesktopText(notificationText)}
                    </span>
                    <span className="notification-text notification-text-mobile">
                      {notificationText}
                    </span>
                  </p>

                  <span className="notification-time">{formatTime(item.created_at)}</span>
                </div>
              </div>

              <button
                className="notification-remove"
                onClick={() => removeNotification(item.id)}
                aria-label="Remove notification"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>

      {loading && <p className="username">{t('loading', language)}</p>}

      {!hasMore && notifications.length > 0 && (
        <p className="username">{t('no_more_notifications', language)}</p>
      )}
    </div>
  );
}

export default Notifications;
