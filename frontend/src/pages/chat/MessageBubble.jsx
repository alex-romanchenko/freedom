import { getFileUrl } from '../../api/fileUrl';

function MessageStatus({ status }) {
  if (status === 'read') {
    return (
      <img
        src="/icons/readed-msg.svg"
        className="message-status-icon"
        alt=""
      />
    );
  }

  if (status === 'delivered') {
    return (
      <img
        src="/icons/delivered.svg"
        className="message-status-icon"
        alt=""
      />
    );
  }

  return (
    <img
      src="/icons/sent.svg"
      className="message-status-icon"
      alt=""
    />
  );
}

function MessageBubble({
  message,
  isMine,
  isGroup,
  parseForwardMessage,
  parseReplyMessage,
  openMessageMenu,
  setOpenedImage,
  setOpenedVideo,
  onOpenUser,
}) {
  const forwardedMessage = parseForwardMessage(message.text);
  const replyMessage = parseReplyMessage(message.text);

  return (
  <div className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
    {isGroup && !isMine && (
      <button
          className="group-message-avatar"
          onClick={() => onOpenUser?.(message.username)}
        >
          {message.avatar ? (
            <img src={getFileUrl(message.avatar)} alt="" />
          ) : (
            <span>{message.display_name?.[0] || '?'}</span>
          )}
        </button>
    )}

    <div
      className="message-bubble"
      onContextMenu={(e) => openMessageMenu(e, message, isMine)}
    >
      {isGroup && !isMine && (
        <button
          className="group-message-author"
          onClick={() => onOpenUser?.(message.username)}
        >
          {message.display_name || message.username}
        </button>
      )}

      {forwardedMessage ? (
        <>
          <div className="message-forward-box">
            <div>
              <span className="forward-gap">Forwarded from</span>
              <strong>{forwardedMessage.name}</strong>
            </div>
          </div>

          <p>{forwardedMessage.text}</p>
        </>
      ) : replyMessage ? (
        <>
          <div className="message-reply-box">
            <strong>{replyMessage.name}</strong>
            <span>{replyMessage.preview}</span>
          </div>

          <p>{replyMessage.text}</p>
        </>
      ) : (
        <>
          {message.text && <p>{message.text}</p>}

          {message.image && (
            <img
              className="message-image"
              src={getFileUrl(message.image)}
              alt=""
              onClick={() => setOpenedImage(getFileUrl(message.image))}
            />
          )}

          {message.video && (
            <div
              className="message-video-wrap"
              onClick={() => setOpenedVideo(getFileUrl(message.video))}
            >
              <video
                className="message-video"
                src={getFileUrl(message.video)}
                autoPlay
                muted
                loop
                playsInline
              />

              <div className="message-video-play">▷</div>
            </div>
          )}
        </>
      )}

      <span className="message-meta">
        <span className="message-time">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {isMine && <MessageStatus status={message.status} />}
      </span>
    </div>
  </div>
);
}

export default MessageBubble;