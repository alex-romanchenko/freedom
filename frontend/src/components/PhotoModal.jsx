import { useEffect, useState } from 'react';
import api from '../api/api';
import EmojiPicker from 'emoji-picker-react';
import { getFileUrl } from '../api/fileUrl';
import { IoHeartOutline, IoHeart } from 'react-icons/io5';

export default function PhotoModal({ photo, onClose, onPhotoChanged }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [modalPhoto, setModalPhoto] = useState(photo);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [likesOpen, setLikesOpen] = useState(false);
  const [likesUsers, setLikesUsers] = useState([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(photo.description || '');

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isOwner = Number(currentUser?.id) === Number(modalPhoto?.user_id);

const handleEmojiSelect = (emojiData) => {
  setCommentText((prev) => prev + emojiData.emoji);
};
  const loadComments = async () => {
    if (!modalPhoto?.id) return;

    try {
      const res = await api.get(`/photos/${modalPhoto.id}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error('Load comments error:', err);
    }
  };

const loadLikes = async () => {
  if (!modalPhoto?.id) return;

  try {
    const res = await api.get(`/photos/${modalPhoto.id}/likes`);
    setLikesUsers(res.data);
    setLikesOpen(true);
  } catch (err) {
    console.error('Load likes error:', err);
  }
};

  const toggleLike = async () => {
  if (!modalPhoto?.id) return;

  try {
    const wasLiked = modalPhoto.is_liked;
    const currentLikes = Number(modalPhoto.likes_count || 0);

    if (wasLiked) {
      await api.delete(`/photos/${modalPhoto.id}/like`);
    } else {
      await api.post(`/photos/${modalPhoto.id}/like`);
    }

    setModalPhoto((prev) => ({
      ...prev,
      is_liked: !wasLiked,
      likes_count: wasLiked ? currentLikes - 1 : currentLikes + 1,
    }));

    onPhotoChanged && onPhotoChanged();
  } catch (err) {
    console.error('Toggle like error:', err);
  }
};

  const addComment = async () => {
  if (!modalPhoto?.id) return;
  if (!commentText.trim()) return;

  try {
    await api.post(`/photos/${modalPhoto.id}/comments`, {
      text: commentText.trim(),
    });

    setCommentText('');

    setModalPhoto((prev) => ({
      ...prev,
      comments_count: Number(prev.comments_count || 0) + 1,
    }));

    loadComments();
    onPhotoChanged && onPhotoChanged();
  } catch (err) {
    console.error('Add comment error:', err);
  }
};

  const deleteComment = async (commentId) => {
    try {
      await api.delete(`/photos/comments/${commentId}`);

      setModalPhoto((prev) => ({
        ...prev,
        comments_count: Math.max(Number(prev.comments_count || 0) - 1, 0),
      }));

      loadComments();
      onPhotoChanged && onPhotoChanged();
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  const saveDescription = async () => {
    if (!modalPhoto?.id) return;
    try {
      await api.put(`/photos/${modalPhoto.id}`, {
        description: editDescription,
      });

      setModalPhoto((prev) => ({
        ...prev,
        description: editDescription,
      }));

      setIsEditing(false);
      onPhotoChanged && onPhotoChanged();
    } catch (err) {
      console.error('Update photo description error:', err);
    }
  };

const deletePhoto = async () => {
  if (!modalPhoto?.id) return;
  try {
    await api.delete(`/photos/${modalPhoto.id}`);
    onPhotoChanged && onPhotoChanged();
    onClose();
  } catch (err) {
    console.error('Delete photo error:', err);
  }
};

  useEffect(() => {
    setModalPhoto(photo);
    setEditDescription(photo.description || '');
  }, [photo]);

  useEffect(() => {
  const handleClickOutside = () => {
    setShowEmojiPicker(false);
  };

  if (showEmojiPicker) {
    document.addEventListener('click', handleClickOutside);
  }

  return () => {
    document.removeEventListener('click', handleClickOutside);
  };
}, [showEmojiPicker]);

useEffect(() => {
  if (modalPhoto?.id) {
    loadComments();
  }
}, [modalPhoto?.id]);

  return (
    <div className="photo-modal-overlay">
      <button className="photo-modal-close" onClick={onClose}>
        ×
      </button>

      <div className="photo-modal">
        <div className="photo-modal-image-wrap">
          <img
            src={getFileUrl(modalPhoto.image)}
            alt=""
          />
        </div>

        <div className="photo-modal-side">
          <div className="photo-modal-user">
            {modalPhoto.avatar ? (
              <img
                src={getFileUrl(modalPhoto.avatar)}
                alt=""
              />
            ) : (
              <div className="photo-modal-avatar">
                {modalPhoto.display_name?.[0] || modalPhoto.displayName?.[0] || '?'}
              </div>
            )}

            <div>
              <strong>{modalPhoto.display_name || modalPhoto.displayName}</strong>
              <p>@{modalPhoto.username}</p>
            </div>

            {isOwner && (
              <div className="post-actions photo-owner-actions">
                <button onClick={() => setIsEditing(true)}>
                  Edit
                </button>

                <button
                  className="danger-btn"
                  onClick={() => setShowDeleteConfirm(true)}>
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="photo-description">
            {isEditing ? (
              <>
                <textarea
                  className="photo-edit-textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Edit description..."
                />

                <div className="modal-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setIsEditing(false);
                      setEditDescription(modalPhoto.description || '');
                    }}
                  >
                    Cancel
                  </button>

                  <button className="primary-btn" onClick={saveDescription}>
                    Save
                  </button>
                </div>
              </>
            ) : (
              <p>{modalPhoto.description || 'No description'}</p>
            )}
          </div>

          <div className="photo-comments">
            {comments.length === 0 && (
              <p className="username">No comments yet</p>
            )}

            {comments.map((comment) => (
              <div className="photo-comment" key={comment.id}>
                {comment.avatar ? (
                  <img
                    src={getFileUrl(comment.avatar)}
                    alt=""
                  />
                ) : (
                  <div className="photo-comment-avatar">
                    {comment.display_name?.[0] || '?'}
                  </div>
                )}

                <div className="photo-comment-body">
                  <strong>{comment.display_name}</strong>
                  <p>{comment.text}</p>
                </div>

                {Number(currentUser?.id) === Number(comment.user_id) && (
                  <button
                    className="photo-comment-delete"
                    onClick={() => deleteComment(comment.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="photo-modal-actions">
            <button
              className="like-btn"
              onClick={toggleLike}
            >
              {modalPhoto.is_liked ? <IoHeart /> : <IoHeartOutline />}
            </button>

            <button className="likes-count" onClick={loadLikes}>
              {modalPhoto.likes_count} likes
            </button>

            <span className="photo-comments-count">
              💬 {modalPhoto.comments_count}
            </span>
          </div>

          <div className="comment-form">
                <textarea
                    className="comment-textarea"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={1}
                />

                <div className="comment-actions">
                    <button
                    type="button"
                    className="emoji-btn"
                      onClick={(e) => {
                            e.stopPropagation();
                            setShowEmojiPicker(!showEmojiPicker);
                        }}
                    >
                    😊
                    </button>

                    <button
                    className="primary-btn"
                    onClick={addComment}
                    >
                    Comment
                    </button>
                </div>

                {showEmojiPicker && (
                <div
                className="photo-emoji-picker-wrap"
                onClick={(e) => e.stopPropagation()}
                >
                <EmojiPicker onEmojiClick={handleEmojiSelect} />
                </div>
                )}
                </div>
        </div>
      </div>

      {likesOpen && (
        <div className="modal-overlay">
          <div className="likes-popup">
            <h3>Liked by</h3>

            {likesUsers.length === 0 && (
              <p className="username">No likes yet</p>
            )}

            {likesUsers.map((user) => (
              <div className="likes-user" key={user.id}>
                {user.avatar ? (
                  <img
                    src={getFileUrl(user.avatar)}
                    alt=""
                  />
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
              onClick={() => setLikesOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
                {showDeleteConfirm && (
            <div className="modal-overlay">
              <div className="logout-popup">
                <h3>Are you sure?</h3>
                <p>Do you want to delete the photo?</p>

                <div className="modal-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>

                  <button
                    className="primary-btn danger-btn"
                    onClick={() => {
                      deletePhoto();
                      setShowDeleteConfirm(false);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}