import { useEffect, useState } from 'react';
import api from '../api/api';
import {
  getUserProfileApi,
  updateMyProfileApi,
  updateAvatarApi,
  updateHeaderApi,
  updateLanguageApi,
} from '../api/usersApi';
import { getFriendsApi } from '../api/followApi';
import PostCard from '../components/PostCard';
import PhotoModal from '../components/PhotoModal';
import { getFileUrl } from '../api/fileUrl';
import { getStoredLanguage, t } from '../utils/i18n';

function Profile({ onOpenFriends, onOpenUser, onOpenPhotos, onPostClick }) {
  const currentUser = JSON.parse(localStorage.getItem('user'));

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [language, setLanguage] = useState(getStoredLanguage());

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

  const changeLanguage = async (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem('language', nextLanguage);

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem(
      'user',
      JSON.stringify({ ...storedUser, language: nextLanguage })
    );

    try {
      await updateLanguageApi(nextLanguage);
    } catch (err) {
      console.error(t('language_update_error', nextLanguage), err);
    }
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

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

    localStorage.setItem(
      'user',
      JSON.stringify({
        ...storedUser,
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

  if (!profile) return <p className="page">{t('loading', language)}</p>;

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
            src={getFileUrl(user.headerImage)}
            alt=""
          />
        ) : (
          <div className="profile-cover empty-cover">Freedom</div>
        )}

        <label className="cover-upload">
          {t('change_cover', language)}
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
              src={getFileUrl(user.avatar)}
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
            {t('edit_profile', language)}
          </button>
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

      <div className="profile-language-row">
        <div className="language-switcher profile-language-switcher">
          {['en', 'uk', 'ru'].map((item) => (
            <button
              key={item}
              type="button"
              className={language === item ? 'active' : ''}
              onClick={() => changeLanguage(item)}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <section className="profile-section">
        <div className="profile-section-header">
          <h3>{t('friends', language)}</h3>

          <button className="link-btn" onClick={onOpenFriends}>
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
            <h2>{t('edit_profile', language)}</h2>

            <input name="displayName" value={form.displayName} onChange={handleChange} placeholder={t('display_name', language)} />
            <input name="username" value={form.username} onChange={handleChange} placeholder={t('username', language)} />
            <input name="firstName" value={form.firstName} onChange={handleChange} placeholder={t('first_name', language)} />
            <input name="lastName" value={form.lastName} onChange={handleChange} placeholder={t('last_name', language)} />

            <input
              name="birthDate"
              type="date"
              value={form.birthDate ? String(form.birthDate).slice(0, 10) : ''}
              onChange={handleChange}
            />

            <input name="city" value={form.city} onChange={handleChange} placeholder={t('city', language)} />
            <input name="country" value={form.country} onChange={handleChange} placeholder={t('country', language)} />

            <select name="gender" value={form.gender} onChange={handleChange}>
              <option value="">{t('gender', language)}</option>
              <option value="female">{t('female', language)}</option>
              <option value="male">{t('male', language)}</option>
              <option value="other">{t('other', language)}</option>
            </select>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setIsEditing(false)}>
                {t('cancel', language)}
              </button>

              <button className="primary-btn" onClick={saveProfile}>
                {t('save', language)}
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
          <img src={getFileUrl(user.avatar)} alt="" />
        </div>
      )}
    </div>
  );
}

export default Profile;
