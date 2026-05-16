import { useEffect, useRef, useState } from 'react';
import { createPostApi } from '../api/postsApi';
import EmojiPicker from 'emoji-picker-react';

function CreatePostForm({ onPostCreated }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
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

  const handleSubmit = async () => {
    if (!text.trim() && !image) return;

    try {
      const formData = new FormData();
      formData.append('text', text);

      if (image) {
        formData.append('image', image);
      }

      await createPostApi(formData);

      setText('');
      setImage(null);
      setShowEmojiPicker(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onPostCreated();
    } catch (err) {
      console.error(err);
      alert('Error creating post');
    }
  };

  return (
    <div className="post-composer">
      <textarea
        placeholder="What’s happening?"
        value={text}
        maxLength={280}
        onChange={(e) => setText(e.target.value)}
      />

      {image && (
        <div className="selected-image-name">
          Selected: {image.name}
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
          accept="image/*"
          hidden
          onChange={(e) => setImage(e.target.files[0])}
        />

        <button
          className="primary-btn composer-post-btn"
          onClick={handleSubmit}
        >
          Post
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