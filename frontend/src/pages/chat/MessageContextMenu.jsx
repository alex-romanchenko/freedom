import {
  FiCornerUpLeft,
  FiCopy,
  FiSend,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import { useMemo, useState } from 'react';
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

  const menuLeft = useMemo(() => {
    if (!messageMenu) return 0;
    if (!showAllReactions) return messageMenu.x;

    const margin = 12;
    const pickerWidth = Math.min(380, window.innerWidth - margin * 2);
    const maxLeft = Math.max(margin, window.innerWidth - pickerWidth - margin);

    return Math.min(Math.max(messageMenu.x, margin), maxLeft);
  }, [messageMenu, showAllReactions]);

  if (!messageMenu) return null;

  return (
    <div
      className={`message-context-menu ${
        messageMenu.openUp ? 'open-up' : ''
      } ${showAllReactions ? 'reactions-expanded' : ''}`}
      style={{
        left: menuLeft,
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
            height={420}
            width="100%"
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {!showAllReactions && (
        <>
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
        </>
      )}
    </div>
  );
}

export default MessageContextMenu;
