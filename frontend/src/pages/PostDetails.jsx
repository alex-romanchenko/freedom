import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import EmojiPicker from 'emoji-picker-react';
import {
  likePostApi,
  unlikePostApi,
  updatePostApi,
  deletePostApi,
} from '../api/postsApi';

export default function PostDetails({
  post,
  onBack,
  onUserClick,
  onPostChanged,
}) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [likesUsers, setLikesUsers] = useState([]);
  const [likesOpen, setLikesOpen] = useState(false);
  const [liked, setLiked] = useState(Boolean(post.is_liked));
  const [likesCount, setLikesCount] = useState(Number(post.likes_count) || 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(post.text);
  const [fullscreen, setFullscreen] = useState(false);

  const emojiRef = useRef(null);
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isOwner = Number(currentUser?.id) === Number(post.user_id);

  const loadComments = async () => {
    const res = await api.get(`/posts/${post.id}/comments`);
    setComments(res.data);
  };

  const loadLikes = async () => {
    const res = await api.get(`/posts/${post.id}/likes`);
    setLikesUsers(res.data);
    setLikesOpen(true);
  };

  const handleLike = async () => {
    if (liked) {
      await unlikePostApi(post.id);
      setLiked(false);
      setLikesCount((prev) => Math.max(prev - 1, 0));
    } else {
      await likePostApi(post.id);
      setLiked(true);
      setLikesCount((prev) => prev + 1);
    }

    onPostChanged && onPostChanged();
  };

  const addComment = async () => {
    if (!text.trim()) return;

    await api.post(`/posts/${post.id}/comments`, {
      text: text.trim(),
    });

    setText('');
    loadComments();
    onPostChanged && onPostChanged();
  };

  const deleteComment = async (id) => {
    await api.delete(`/posts/comments/${id}`);
    loadComments();
    onPostChanged && onPostChanged();
  };

  const savePost = async () => {
    await updatePostApi(post.id, { text: editedText });
    setIsEditing(false);
    onPostChanged && onPostChanged();
  };

  const removePost = async () => {
    if (!window.confirm('Delete this post?')) return;

    await deletePostApi(post.id);
    onBack();
  };

  useEffect(() => {
    loadComments();
  }, [post.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="post-details">
      <div className="post-details-header">
        <button onClick={onBack} className="back-btn">
          ←
        </button>

        <h3>Post</h3>
      </div>

      <div className="post-header">
        <div
          onClick={() => onUserClick(post.username)}
          style={{ cursor: 'pointer' }}
        >
          <strong>{post.display_name}</strong>
          <span className="username"> @{post.username}</span>
        </div>

        {isOwner && (
          <div className="post-actions">
            <button onClick={() => setIsEditing((prev) => !prev)}>
              Edit
            </button>

            <button className="danger-btn" onClick={removePost}>
              Delete
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="post-edit-box">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            maxLength={280}
          />

          <button className="primary-btn" onClick={savePost}>
            Save
          </button>
        </div>
      ) : (
        <p className="post-text">{editedText}</p>
      )}

      {post.image && (
        <img
          className="post-big-image"
          src={`http://localhost:5000${post.image}`}
          alt=""
          onClick={() => setFullscreen(true)}
        />
      )}

      <div className="photo-modal-actions post-details-like-row">
        <button
          className={`like-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          {liked ? '♥' : '♡'}
        </button>

        <button className="likes-count" onClick={loadLikes}>
          {likesCount} likes
        </button>

        <span className="photo-comments-count">
          💬 {comments.length}
        </span>
      </div>

      <div className="post-comments">
        {comments.length === 0 && (
          <p className="username">No comments yet</p>
        )}

        {comments.map((comment) => (
          <div className="photo-comment" key={comment.id}>
            {comment.avatar ? (
              <img
                src={`http://localhost:5000${comment.avatar}`}
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

      <div className="comment-form">
        <textarea
          className="comment-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          rows={1}
        />

        <div className="comment-actions">
          <button
            type="button"
            className="emoji-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmoji((prev) => !prev);
            }}
          >
            😊
          </button>

          <button className="primary-btn" onClick={addComment}>
            Comment
          </button>
        </div>

        {showEmoji && (
          <div
            className="photo-emoji-picker-wrap"
            ref={emojiRef}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                setText((prev) => prev + emojiData.emoji);
              }}
            />
          </div>
        )}
      </div>

      {fullscreen && (
        <div
          className="image-preview-overlay"
          onClick={() => setFullscreen(false)}
        >
          <img
            src={`http://localhost:5000${post.image}`}
            alt=""
          />
        </div>
      )}

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
                    src={`http://localhost:5000${user.avatar}`}
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
    </div>
  );
}