import {
  FiCornerUpLeft,
  FiCopy,
  FiSend,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import { useState } from 'react';
import EmojiPicker from 'emoji-picker-react';

const quickReactions = ['😁', '❤️', '👍', '👎', '🔥', '👏'];

function MessageContextMenu({
  messageMenu,
  startReply,
  copyMessageText,
  forwardMessage,
  startEditMessage,
  deleteMessage,
  setMessageReaction,
}) {
  const [showAllReactions, setShowAllReactions] = useState(false);

  if (!messageMenu) return null;

  return (
    <div
      className={`message-context-menu ${
        messageMenu.openUp ? 'open-up' : ''
      }`}
      style={{
        left: messageMenu.x,
        top: messageMenu.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="message-reaction-row">
        {quickReactions.map((reaction) => (
          <button
            key={reaction}
            type="button"
            className="message-reaction-btn"
            onClick={() => setMessageReaction(messageMenu.message, reaction)}
          >
            {reaction}
          </button>
        ))}

        <button
          type="button"
          className="message-reaction-btn"
          onClick={() => setShowAllReactions((value) => !value)}
        >
         ⌄
        </button>
      </div>

      {showAllReactions && (
        <div className="message-reaction-picker">
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              setMessageReaction(messageMenu.message, emojiData.emoji);
            }}
            height={320}
            width="100%"
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      <button onClick={startReply}>
        <FiCornerUpLeft />
        Reply
      </button>

      <button onClick={copyMessageText}>
        <FiCopy />
        Copy Text
      </button>

      <button onClick={forwardMessage}>
        <FiSend />
        Forward
      </button>

      {messageMenu.isMine && (
        <button onClick={startEditMessage}>
          <FiEdit2 />
          Edit
        </button>
      )}

      <button className="danger" onClick={deleteMessage}>
        <FiTrash2 />
        Delete
      </button>
    </div>
  );
}

export default MessageContextMenu;
