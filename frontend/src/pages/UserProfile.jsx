import { useEffect, useState } from 'react';
import api from '../api/api';
import { getUserProfileApi } from '../api/usersApi';
import { getUserFriendsApi } from '../api/followApi';
import FollowButton from '../components/FollowButton';
import { createConversationApi } from '../api/messagesApi';
import PostCard from '../components/PostCard';
import PhotoModal from '../components/PhotoModal';
import { getFileUrl } from '../api/fileUrl';

function UserProfile({
  username,
  onMessage,
  onOpenUser,
  onOpenPhotos,
  onOpenFriends,
  onPostClick,
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

  if (!profile) return <p className="page">Loading...</p>;

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
            />

            <button className="primary-btn" onClick={handleMessage}>
              Message
            </button>
          </div>
        </div>

        <div className="profile-details">
          <p><strong>First name:</strong> {firstName || 'Not specified'}</p>
          <p><strong>Last name:</strong> {lastName || 'Not specified'}</p>
          <p>
            <strong>Birthday:</strong>{' '}
            {birthDate ? String(birthDate).slice(0, 10) : 'Not specified'}
          </p>
          <p><strong>City:</strong> {user.city || 'Not specified'}</p>
          <p><strong>Country:</strong> {user.country || 'Not specified'}</p>
          <p><strong>Gender:</strong> {user.gender || 'Not specified'}</p>
        </div>
      </div>

      <section className="profile-section">
        <div className="profile-section-header">
          <h3>Friends</h3>

          <button
            className="link-btn"
            onClick={() => onOpenFriends(user.username)}
          >
            Show all friends
          </button>
        </div>

        <div className="profile-friends-preview">
          {friends.length === 0 && (
            <p className="username">No friends yet</p>
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
          <h3>Photos</h3>

          <button
            className="link-btn"
            onClick={() => onOpenPhotos(user.id)}
          >
            Show all photos
          </button>
        </div>

        <div className="profile-photos-preview">
          {photos.length === 0 && (
            <p className="username">No photos yet</p>
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
        <strong>Posts</strong>
      </div>

      <div className="profile-posts">
        {profile.posts.length === 0 && <p>No posts yet</p>}

        {profile.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            canManage={false}
            onPostClick={onPostClick}
            onUserClick={onOpenUser}
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