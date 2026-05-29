import {
  FiCornerUpLeft,
  FiCopy,
  FiSend,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';

function MessageContextMenu({
  messageMenu,
  startReply,
  copyMessageText,
  forwardMessage,
  startEditMessage,
  deleteMessage,
}) {
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