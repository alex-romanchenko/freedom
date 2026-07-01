import { useEffect, useState } from 'react';
import api from '../api/api';
import { getUserProfileApi } from '../api/usersApi';
import { getUserFriendsApi } from '../api/followApi';
import FollowButton from '../components/FollowButton';
import { createConversationApi } from '../api/messagesApi';
import PostCard from '../components/PostCard';
import PhotoModal from '../components/PhotoModal';
import { getFileUrl } from '../api/fileUrl';
import { t } from '../utils/i18n';

function UserProfile({
  username,
  onMessage,
  onOpenUser,
  onOpenPhotos,
  onOpenFriends,
  onPostClick,
  language,
}) {
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  const loadPhotos = async (userId) => {
    const res = await api.get(`/photos/user/${userId}`);
    setPhotos(res.data.slice(0, 5));
  };

  const loadProfile = async () => {
    const data = await getUserProfileApi(username);
    setProfile(data);

    const friendsData = await getUserFriendsApi(username);
    setFriends(friendsData.slice(0, 4));

    await loadPhotos(data.user.id);
  };

  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username]);



  const handleMessage = async () => {
    await createConversationApi(profile.user.id);
    onMessage(profile.user.id);
  };

  if (!profile) return <p className="page">{t('loading', language)}</p>;

  const user = profile.user;

  const firstName = user.firstName || user.first_name;
  const lastName = user.lastName || user.last_name;
  const birthDate = user.birthDate || user.birth_date;

  return (
    <div className="profile-page">
      <div className="profile-cover-wrap">
        {user.headerImage || user.header_image ? (
          <img
            className="profile-cover"
            src={getFileUrl(user.headerImage || user.header_image)}
            alt=""
          />
        ) : (
          <div className="profile-cover empty-cover">Freedom</div>
        )}
      </div>

      <div className="profile-main">
        <div className="profile-avatar-wrap">
          {user.avatar ? (
            <img
                className="profile-avatar"
                src={getFileUrl(user.avatar)}
                alt=""
                onClick={() =>
                  setSelectedAvatar({
                    image: user.avatar,
                  })
                }
              />
          ) : (
            <div className="profile-avatar avatar-placeholder">
              {user.displayName?.[0] || '?'}
            </div>
          )}
        </div>

        <div className="profile-title-row">
          <div>
            <h2>{user.displayName}</h2>
            <p className="username">@{user.username}</p>
          </div>

          <div className="profile-actions">
            <FollowButton
              userId={user.id}
              initialIsFollowing={user.is_following}
              language={language}
            />

            <button className="primary-btn" onClick={handleMessage}>
              {t('message', language)}
            </button>
          </div>
        </div>

        <div className="profile-details">
          <p><strong>{t('first_name', language)}:</strong> {firstName || t('not_specified', language)}</p>
          <p><strong>{t('last_name', language)}:</strong> {lastName || t('not_specified', language)}</p>
          <p>
            <strong>{t('birthday', language)}:</strong>{' '}
            {birthDate ? String(birthDate).slice(0, 10) : t('not_specified', language)}
          </p>
          <p><strong>{t('city', language)}:</strong> {user.city || t('not_specified', language)}</p>
          <p><strong>{t('country', language)}:</strong> {user.country || t('not_specified', language)}</p>
          <p><strong>{t('gender', language)}:</strong> {user.gender ? t(user.gender, language) : t('not_specified', language)}</p>
        </div>
      </div>

      <section className="profile-section">
        <div className="profile-section-header">
          <h3>{t('friends', language)}</h3>

          <button
            className="link-btn"
            onClick={() => onOpenFriends(user.username)}
          >
            {t('show_all_friends', language)}
          </button>
        </div>

        <div className="profile-friends-preview">
          {friends.length === 0 && (
            <p className="username">{t('no_friends', language)}</p>
          )}

          {friends.map((friend) => (
            <div
              key={friend.id}
              className="profile-friend"
              onClick={() => onOpenUser(friend.username)}
            >
              {friend.avatar ? (
                <img
                  src={getFileUrl(friend.avatar)}
                  alt=""
                />
              ) : (
                <div className="profile-friend-placeholder">
                  {friend.display_name?.[0] || '?'}
                </div>
              )}

              <span>{friend.display_name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-header">
          <h3>{t('photos', language)}</h3>

          <button
            className="link-btn"
            onClick={() => onOpenPhotos(user.id)}
          >
            {t('show_all_photos', language)}
          </button>
        </div>

        <div className="profile-photos-preview">
          {photos.length === 0 && (
            <p className="username">{t('no_photos', language)}</p>
          )}

          {photos.map((photo) => (
            <img
              key={photo.id}
              src={getFileUrl(photo.image)}
              alt=""
              onClick={() => setSelectedPhoto(photo)}
            />
          ))}
        </div>
      </section>

      <div className="profile-tabs">
        <strong>{t('posts', language)}</strong>
      </div>

      <div className="profile-posts">
        {profile.posts.length === 0 && <p>{t('no_posts', language)}</p>}

        {profile.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            canManage={false}
            onPostClick={onPostClick}
            onUserClick={onOpenUser}
            language={language}
          />
        ))}
      </div>

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onPhotoChanged={() => loadPhotos(user.id)}
        />
      )}
      {selectedAvatar && (
  <PhotoModal
    photo={selectedAvatar}
    onClose={() => setSelectedAvatar(null)}
  />
)}
    </div>
  );
}

export default UserProfile;
