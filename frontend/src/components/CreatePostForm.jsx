import { useEffect, useRef, useState } from 'react';
import { createPostApi } from '../api/postsApi';
import EmojiPicker from 'emoji-picker-react';
import { t } from '../utils/i18n';
import { compressImageFile } from '../utils/mediaCompression';

function CreatePostForm({ onPostCreated, language }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const uploadControllerRef = useRef(null);

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
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('text', text.trim());

      if (image) {
        const uploadImage = await compressImageFile(image, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82,
        });
        formData.append('image', uploadImage);
      }

      await createPostApi(formData, {
        signal: controller.signal,
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });

      setText('');
      setImage(null);
      setImagePreview(null);
      setShowEmojiPicker(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onPostCreated && onPostCreated();
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || controller.signal.aborted) return;
      console.error(err);
      alert(t('error_creating_post', language));
    } finally {
      uploadControllerRef.current = null;
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const cancelUpload = () => uploadControllerRef.current?.abort();

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

          {isUploading && (
            <div className="post-upload-progress" aria-live="polite">
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle className="post-upload-track" cx="22" cy="22" r="19" />
                <circle className="post-upload-value" cx="22" cy="22" r="19"
                  style={{ strokeDashoffset: 119.4 - (119.4 * (uploadProgress ?? 0)) / 100 }} />
              </svg>
              <button type="button" onClick={cancelUpload} aria-label="Cancel upload">×</button>
              <span>{uploadProgress ?? 0}%</span>
            </div>
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
          disabled={isUploading}
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
