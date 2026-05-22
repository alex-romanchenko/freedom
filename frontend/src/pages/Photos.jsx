import { useEffect, useState } from 'react';
import api from '../api/api';
import PhotoModal from '../components/PhotoModal';
import { getFileUrl } from '../api/fileUrl';
import { IoHeartOutline, IoHeart } from 'react-icons/io5';

export default function Photos({ userId }) {
  const [photos, setPhotos] = useState([]);
  const [description, setDescription] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [likesUsers, setLikesUsers] = useState([]);
  const [likesPhotoId, setLikesPhotoId] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isMyPhotos = Number(currentUser?.id) === Number(userId);

  const loadPhotos = async () => {
    try {
      const res = await api.get(`/photos/user/${userId}`);
      setPhotos(res.data);
    } catch (err) {
      console.error('Load photos error:', err);
    }
  };

  const uploadPhoto = async (file) => {
    if (!isMyPhotos || !file) return;

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('description', description);

    try {
      await api.post('/photos', formData);
      setDescription('');
      loadPhotos();
    } catch (err) {
      console.error('Upload photo error:', err);
    }
  };

  const toggleLike = async (photo, e) => {
    e.stopPropagation();

    try {
      if (photo.is_liked) {
        await api.delete(`/photos/${photo.id}/like`);
      } else {
        await api.post(`/photos/${photo.id}/like`);
      }

      loadPhotos();
    } catch (err) {
      console.error('Toggle photo like error:', err);
    }
  };

  const openLikes = async (photo, e) => {
    e.stopPropagation();

    try {
      const res = await api.get(`/photos/${photo.id}/likes`);
      setLikesUsers(res.data);
      setLikesPhotoId(photo.id);
    } catch (err) {
      console.error('Load photo likes error:', err);
    }
  };

  useEffect(() => {
    if (userId) {
      loadPhotos();
    }
  }, [userId]);

  return (
    <div className="photos-page">
      <div className="photos-header">
        <h2>Photos</h2>

        {isMyPhotos && (
          <label className="primary-btn">
            Add photo
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => uploadPhoto(e.target.files[0])}
            />
          </label>
        )}
      </div>

      {isMyPhotos && (
        <textarea
          className="photo-description-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add description..."
        />
      )}

      <div className="photos-grid">
        {photos.length === 0 && (
          <p className="empty-photos">No photos yet</p>
        )}

        {photos.map((photo) => (
          <div
            className="photo-card"
            key={photo.id}
            onClick={() => setSelectedPhoto(photo)}
          >
            <img
              src={getFileUrl(photo.image)}
              alt=""
            />

            {photo.description && (
              <p className="photo-card-description">
                {photo.description}
              </p>
            )}

            <div className="photo-card-actions">
            <button
              className="like-btn"
              onClick={toggleLike}
            >
              {photo.is_liked ? <IoHeart /> : <IoHeartOutline />}
            </button>

              <button
                className="photo-count-btn"
                onClick={(e) => openLikes(photo, e)}
              >
                {photo.likes_count} likes
              </button>

              <span className="photo-comments-count">
                💬 {photo.comments_count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedPhoto && (
            <PhotoModal
                photo={selectedPhoto}
                onClose={() => setSelectedPhoto(null)}
                onPhotoChanged={loadPhotos}
            />
            )}

      {likesPhotoId && (
        <div className="modal-overlay">
          <div className="likes-popup">
            <h3>Liked by</h3>

            {likesUsers.length === 0 && (
              <p className="username">No likes yet</p>
            )}

            {likesUsers.map((user) => (
              <div className="likes-user" key={user.id}>
                {user.avatar ? (
                  <img src={getFileUrl(user.avatar)} alt="" />
                ) : (
                  <div className="likes-avatar">
                    {user.display_name?.[0] || '?'}
                  </div>
                )}

                <div>
                  <strong>{user.display_name}</strong>
                  <p>@{user.username}</p>
                </div>
              </div>
            ))}

            <button
              className="secondary-btn"
              onClick={() => {
                setLikesPhotoId(null);
                setLikesUsers([]);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}