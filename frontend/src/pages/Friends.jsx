import { useEffect, useState } from 'react';
import { searchUsersApi } from '../api/usersApi';
import {
  followUserApi,
  unfollowUserApi,
  getFriendsApi,
  getUserFriendsApi,
  getIncomingRequestsApi,
  markRequestsSeenApi,
} from '../api/followApi';
import { createConversationApi } from '../api/messagesApi';
import { getFileUrl } from '../api/fileUrl';
import { t } from '../utils/i18n';

function Friends({ username, onOpenChat, onOpenUser, onRequestsSeen, requestSignal, language }) {
  const [activeTab, setActiveTab] = useState('friends');
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);

  const loadFriends = async () => {
    const data = username
      ? await getUserFriendsApi(username)
      : await getFriendsApi();

    setFriends(data);
  };

  const loadIncomingRequests = async () => {
    const data = await getIncomingRequestsApi();
    setIncomingRequests(data);
  };

  

useEffect(() => {
  loadFriends();
}, [username]);

useEffect(() => {
  if (!username) {
    loadIncomingRequests();
  }
}, [username]);
  
  useEffect(() => {
  if (requestSignal > 0) {
    loadIncomingRequests();
  }
}, [requestSignal]);

  const requestsBadgeCount = incomingRequests.filter(
    (request) => request.seen_by_following === false
  ).length;

  const openRequestsTab = async () => {
    setActiveTab('requests');

    if (requestsBadgeCount > 0) {
      await markRequestsSeenApi();

      setIncomingRequests((prev) =>
        prev.map((user) => ({
          ...user,
          seen_by_following: true,
        }))
      );
      onRequestsSeen && onRequestsSeen();
    }
  };

  const searchUsers = async () => {
    if (!query.trim()) return;

    const data = await searchUsersApi(query);
    setSearchResults(data);
  };

  const addFriend = async (user) => {
    await followUserApi(user.id);

    setSearchResults((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, is_following: true } : u
      )
    );

    setIncomingRequests((prev) =>
      prev.filter((u) => u.id !== user.id)
    );

    loadFriends();
    loadIncomingRequests();
  };

  const removeFriend = async (userId) => {
    await unfollowUserApi(userId);

    setFriends((prev) => prev.filter((u) => u.id !== userId));

    setSearchResults((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, is_following: false } : u
      )
    );

    loadIncomingRequests();
  };

  const writeMessage = async (userId) => {
    await createConversationApi(userId);
    onOpenChat(userId);
  };

  const renderAvatar = (user) => {
    if (user.avatar) {
      return (
        <img
          className="friend-avatar"
          src={getFileUrl(user.avatar)}
          alt=""
          onClick={() => onOpenUser(user.username)}
          style={{ cursor: 'pointer' }}
        />
      );
    }

    return (
      <div
        className="friend-avatar friend-placeholder"
        onClick={() => onOpenUser(user.username)}
        style={{ cursor: 'pointer' }}
      >
        {user.display_name?.[0] || '?'}
      </div>
    );
  };

  const renderUserCard = (user, isFriendList = false, isRequest = false) => (
    <div key={user.id} className="friend-card">
      {renderAvatar(user)}

      <div
        className="friend-info"
        onClick={() => onOpenUser(user.username)}
        style={{ cursor: 'pointer' }}
      >
        <strong>{user.display_name}</strong>
        <p className="username">@{user.username}</p>
      </div>

      <div className="friend-actions">
        {isRequest ? (
            <button
              className="secondary-btn"
              onClick={() => addFriend(user)}
            >
              {t('add', language)}
            </button>
        ) : isFriendList || user.is_following ? (
          <button className="secondary-btn" onClick={() => removeFriend(user.id)}>
            {t('remove', language)}
          </button>
        ) : (
          <button className="secondary-btn" onClick={() => addFriend(user)}>
            {t('add', language)}
          </button>
        )}

        <button className="primary-btn" onClick={() => writeMessage(user.id)}>
          {t('message', language)}
        </button>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="feed-tabs friends-tabs">
        <button
          className={activeTab === 'friends' ? 'active' : ''}
          onClick={() => setActiveTab('friends')}
        >
          {t('friends', language)}
        </button>

        <button
          className={activeTab === 'requests' ? 'active' : ''}
          onClick={openRequestsTab}
        >
          {t('friends_requests_tab', language)}
          {requestsBadgeCount > 0 && (
            <span className="friend-request-badge">
              {requestsBadgeCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'friends' && (
        <>
          <h3>{t('find_new_friends', language)}</h3>

          <div className="friends-search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchUsers();
                }
              }}
              placeholder={t('find_user_placeholder', language)}
            />

            <button className="primary-btn" onClick={searchUsers}>
              {t('search', language)}
            </button>
          </div>

          <div className="friends-list">
            {searchResults.map((user) => renderUserCard(user))}
          </div>

          <hr />

          <h3>{t('your_friends', language)}</h3>

          <div className="friends-list">
            {friends.length === 0 && (
              <p className="username">{t('no_friends', language)}</p>
            )}

            {friends.map((user) => renderUserCard(user, true))}
          </div>
        </>
      )}

      {activeTab === 'requests' && (
        <>
          <h3>{t('friend_requests', language)}</h3>

          <div className="friends-list">
            {incomingRequests.length === 0 && (
              <p className="username">{t('no_friend_requests', language)}</p>
            )}

            {incomingRequests.map((user) =>
              renderUserCard(user, false, true)
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Friends;
