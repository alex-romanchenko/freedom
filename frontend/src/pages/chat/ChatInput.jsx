import { useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { FiImage, FiSmile, FiSend } from 'react-icons/fi';

function ChatInput({
  replyTo,
  setReplyTo,
  editingMessage,
  setEditingMessage,
  setText,
  text,
  chatFile,
  setChatFile,
  chatImageInputRef,
  textareaRef,
  handleTextChange,
  handlePasteImage,
  showChatEmoji,
  setShowChatEmoji,
  chatEmojiRef,
  parseReplyMessage,
  saveEditedMessage,
  sendMessage,
}) {
  const emojiTimerRef = useRef(null);

  const openEmojiWithDelay = () => {
    clearTimeout(emojiTimerRef.current);

    emojiTimerRef.current = setTimeout(() => {
      setShowChatEmoji(true);
    }, 180);
  };

  const closeEmojiWithDelay = () => {
    clearTimeout(emojiTimerRef.current);

    emojiTimerRef.current = setTimeout(() => {
      setShowChatEmoji(false);
    }, 220);
  };

  const keepEmojiOpen = () => {
    clearTimeout(emojiTimerRef.current);
    setShowChatEmoji(true);
  };

  return (
    <>
      {replyTo && (
        <div className="reply-preview">
          <strong>Reply to {replyTo.display_name}</strong>
          <p>
            {parseReplyMessage(replyTo.text)
              ? parseReplyMessage(replyTo.text).text
              : replyTo.text}
          </p>
          <button onClick={() => setReplyTo(null)}>×</button>
        </div>
      )}

      {editingMessage && (
        <div className="reply-preview">
          <strong>Editing message</strong>
          <p>{editingMessage.text}</p>
          <button
            onClick={() => {
              setEditingMessage(null);
              setText('');
            }}
          >
            ×
          </button>
        </div>
      )}

      {chatFile && (
        <div className="chat-image-preview">
          {chatFile.type.startsWith('video/') ? (
            <video src={URL.createObjectURL(chatFile)} controls />
          ) : (
            <img src={URL.createObjectURL(chatFile)} alt="" />
          )}

          <button onClick={() => setChatFile(null)}>×</button>
        </div>
      )}

      <div className="chat-input-zone">
        <div className="chat-input-row">
          <div className="chat-input-box">
            <button
              type="button"
              className="chat-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                chatImageInputRef.current.click();
              }}
            >
              <FiImage />
            </button>

            <input
              ref={chatImageInputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setChatFile(file);
                e.target.value = '';
              }}
            />

            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onPaste={handlePasteImage}
              placeholder="Write a message..."
              rows={1}
              className="chat-textarea"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  editingMessage ? saveEditedMessage() : sendMessage();
                }
              }}
            />

            <div
              className="chat-emoji-hover-area"
              onMouseEnter={openEmojiWithDelay}
              onMouseLeave={closeEmojiWithDelay}
            >
              <button type="button" className="chat-icon-btn">
                <FiSmile />
              </button>
            </div>
          </div>

          <button
            type="button"
            className="chat-send-btn"
            disabled={!text.trim() && !chatFile}
            onClick={editingMessage ? saveEditedMessage : sendMessage}
          >
            <FiSend />
          </button>
        </div>

        {showChatEmoji && (
          <div
            className="chat-emoji-picker"
            ref={chatEmojiRef}
            onMouseEnter={keepEmojiOpen}
            onMouseLeave={closeEmojiWithDelay}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                setText((prev) => prev + emojiData.emoji);
              }}
              height={350}
              width="100%"
              previewConfig={{
                showPreview: false,
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default ChatInput;