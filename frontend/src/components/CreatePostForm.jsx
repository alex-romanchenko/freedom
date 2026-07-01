import { useEffect, useRef, useState } from 'react';
import { createPostApi } from '../api/postsApi';
import EmojiPicker from 'emoji-picker-react';
import { t } from '../utils/i18n';

function CreatePostForm({ onPostCreated, language }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!text.trim() && !image) return;

    try {
      const formData = new FormData();
      formData.append('text', text.trim());

      if (image) {
        formData.append('image', image);
      }

      await createPostApi(formData);

      setText('');
      setImage(null);
      setImagePreview(null);
      setShowEmojiPicker(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onPostCreated && onPostCreated();
    } catch (err) {
      console.error(err);
      alert(t('error_creating_post', language));
    }
  };

  return (
    <div className="post-composer">
      <textarea
        placeholder={t('whats_happening', language)}
        value={text}
        maxLength={280}
        onChange={(e) => setText(e.target.value)}
      />

      {imagePreview && (
        <div className="selected-image-preview">
          {image?.type?.startsWith('video/') ? (
            <video
              src={imagePreview}
              controls
              playsInline
              className="selected-video-preview"
            />
          ) : (
            <img src={imagePreview} alt="Preview" />
          )}

          <button
            type="button"
            className="remove-selected-image-btn"
            onClick={() => {
              setImage(null);
              setImagePreview(null);

              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="composer-actions">
        <div className="composer-icons">
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
          >
            🖼️
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmojiPicker((prev) => !prev);
            }}
          >
            😊
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={handleImageChange}
        />

        <button
          className="primary-btn composer-post-btn"
          onClick={handleSubmit}
        >
          {t('post', language)}
        </button>
      </div>

      {showEmojiPicker && (
        <div
          className="emoji-picker-wrap"
          ref={emojiPickerRef}
          onClick={(e) => e.stopPropagation()}
        >
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              setText((prev) => prev + emojiData.emoji);
            }}
            height={380}
            width={320}
          />
        </div>
      )}
    </div>
  );
}

export default CreatePostForm;
