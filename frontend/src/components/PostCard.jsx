import { useState } from 'react';
import {
  likePostApi,
  unlikePostApi,
  updatePostApi,
  deletePostApi,
} from '../api/postsApi';
import { getFileUrl } from '../api/fileUrl';
import { IoHeartOutline, IoHeart } from 'react-icons/io5';

function PostCard({
  post,
  onUserClick,
  onPostClick,
  canManage = false,
  onPostChanged,
}) {
  const [liked, setLiked] = useState(Boolean(post.is_liked));
  const [likesCount, setLikesCount] = useState(Number(post.likes_count) || 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(post.text);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLike = async () => {
    try {
      if (liked) {
        await unlikePostApi(post.id);
        setLiked(false);
        setLikesCount((prev) => Math.max(prev - 1, 0));
      } else {
        await likePostApi(post.id);
        setLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const savePost = async () => {
    if (!editedText.trim()) return;

    await updatePostApi(post.id, { text: editedText.trim() });
    setIsEditing(false);
    onPostChanged && onPostChanged();
  };

  const removePost = async () => {
    await deletePostApi(post.id);
    setShowDeleteConfirm(false);
    onPostChanged && onPostChanged();
  };

  return (
    <>
      <div
        className={`post-card ${isEditing ? 'post-card-editing' : ''}`}
        onClick={() => {
          if (!isEditing) {
            onPostClick && onPostClick(post);
          }
        }}
      >
        <div className="post-header">
          <div>
            <button
              className="user-button"
              onClick={(e) => {
                e.stopPropagation();
                onUserClick && onUserClick(post.username);
              }}
            >
              {post.display_name}
            </button>

            <span className="username"> @{post.username}</span>
          </div>

          {canManage && (
            <div
              className="post-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setIsEditing((prev) => !prev)}>
                {isEditing ? 'Cancel' : 'Edit'}
              </button>

              <button
                className="danger-btn"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div
            className="post-edit-box"
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              className="post-edit-textarea"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              maxLength={280}
              placeholder="Edit your post..."
            />

            <div className="post-edit-footer">
              <span className="username">
                {editedText.length}/280
              </span>

              <button className="primary-btn" onClick={savePost}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <p>{post.text}</p>
        )}

        {post.image && (
          <img
            src={getFileUrl(post.image)}
            alt=""
          />
        )}

        <br />
        <br />

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`like-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            {liked ? <IoHeart /> : <IoHeartOutline />}
          </button>

          <span className="username">{likesCount}</span>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="delete-post-popup">
            <h3>Delete post?</h3>

            <p>
              Do you want to remove this post?
            </p>

            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>

              <button
                className="danger-confirm-btn"
                onClick={removePost}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PostCard;