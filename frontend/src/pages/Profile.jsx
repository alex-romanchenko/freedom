import { useEffect, useState } from 'react';
import api from '../api/api';
import {
  getUserProfileApi,
  updateMyProfileApi,
  updateAvatarApi,
  updateHeaderApi,
} from '../api/usersApi';
import { getFriendsApi } from '../api/followApi';
import PostCard from '../components/PostCard';
import PhotoModal from '../components/PhotoModal';

function Profile({ onOpenFriends, onOpenUser, onOpenPhotos, onPostClick }) {
  const currentUser = JSON.parse(localStorage.getItem('user'));

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const [form, setForm] = useState({
    username: '',
    displayName: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    city: '',
    country: '',
    gender: '',
  });

  const loadPhotos = async (userId) => {
    try {
      const res = await api.get(`/photos/user/${userId}`);
      setPhotos(res.data.slice(0, 5));
    } catch (err) {
      console.error('Load profile photos error:', err);
    }
  };

  const loadProfile = async () => {
    const data = await getUserProfileApi(currentUser.username);
    setProfile(data);

    setForm({
      username: data.user.username || '',
      displayName: data.user.displayName || '',
      firstName: data.user.firstName || data.user.first_name || '',
      lastName: data.user.lastName || data.user.last_name || '',
      birthDate: data.user.birthDate || data.user.birth_date || '',
      city: data.user.city || '',
      country: data.user.country || '',
      gender: data.user.gender || '',
    });

    await loadPhotos(data.user.id);
  };

  const loadFriends = async () => {
    const data = await getFriendsApi();
    setFriends(data.slice(0, 4));
  };

  useEffect(() => {
    loadProfile();
    loadFriends();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const saveProfile = async () => {
    const payload = {
      ...form,
      birthDate: form.birthDate || null,
    };

    await updateMyProfileApi(payload);

    localStorage.setItem(
      'user',
      JSON.stringify({
        ...currentUser,
        username: payload.username,
        displayName: payload.displayName,
      })
    );

    setIsEditing(false);
    loadProfile();
  };

  const uploadAvatar = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    await updateAvatarApi(formData);
    loadProfile();
  };

  const uploadHeader = async (file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('headerImage', file);

    await updateHeaderApi(formData);
    loadProfile();
  };

  if (!profile) return <p className="page">Loading...</p>;

  const user = profile.user;

  const firstName = user.firstName || user.first_name;
  const lastName = user.lastName || user.last_name;
  const birthDate = user.birthDate || user.birth_date;

  return (
    <div className="profile-page">
      <div className="profile-cover-wrap">
        {user.headerImage ? (
          <img
            className="profile-cover"
            src={`http://localhost:5000${user.headerImage}`}
            alt=""
          />
        ) : (
          <div className="profile-cover empty-cover">Freedom</div>
        )}

        <label className="cover-upload">
          Change cover
          <input
            type="file"
            hidden
            onChange={(e) => uploadHeader(e.target.files[0])}
          />
        </label>
      </div>

      <div className="profile-main">
        <div className="profile-avatar-wrap">
          {user.avatar ? (
            <img
              className="profile-avatar"
              src={`http://localhost:5000${user.avatar}`}
              alt=""
              onClick={() => setAvatarPreviewOpen(true)}
            />
          ) : (
            <div className="profile-avatar avatar-placeholder">
              {user.displayName?.[0] || '?'}
            </div>
          )}

          <label className="avatar-upload">
            +
            <input
              type="file"
              hidden
              onChange={(e) => uploadAvatar(e.target.files[0])}
            />
          </label>
        </div>

        <div className="profile-title-row">
          <div>
            <h2>{user.displayName}</h2>
            <p className="username">@{user.username}</p>
          </div>

          <button
            className="secondary-btn profile-edit-btn"
            onClick={() => setIsEditing(true)}
          >
            Edit profile
          </button>
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

          <button className="link-btn" onClick={onOpenFriends}>
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
                  src={`http://localhost:5000${friend.avatar}`}
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
              src={`http://localhost:5000${photo.image}`}
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
            canManage={true}
            onPostChanged={loadProfile}
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

      {isEditing && (
        <div className="modal-overlay">
          <div className="profile-edit-modal">
            <h2>Edit profile</h2>

            <input name="displayName" value={form.displayName} onChange={handleChange} placeholder="Display name" />
            <input name="username" value={form.username} onChange={handleChange} placeholder="Username" />
            <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="First name" />
            <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Last name" />

            <input
              name="birthDate"
              type="date"
              value={form.birthDate ? String(form.birthDate).slice(0, 10) : ''}
              onChange={handleChange}
            />

            <input name="city" value={form.city} onChange={handleChange} placeholder="City" />
            <input name="country" value={form.country} onChange={handleChange} placeholder="Country" />

            <select name="gender" value={form.gender} onChange={handleChange}>
              <option value="">Gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setIsEditing(false)}>
                Cancel
              </button>

              <button className="primary-btn" onClick={saveProfile}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {avatarPreviewOpen && user.avatar && (
        <div
          className="avatar-preview-modal"
          onClick={() => setAvatarPreviewOpen(false)}
        >
          <img src={`http://localhost:5000${user.avatar}`} alt="" />
        </div>
      )}
    </div>
  );
}

export default Profile;