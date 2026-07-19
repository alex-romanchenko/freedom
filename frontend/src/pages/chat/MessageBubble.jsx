import { getFileUrl } from '../../api/fileUrl';
import AudioMessagePlayer from './AudioMessagePlayer';
import { t } from '../../utils/i18n';
import {
  IoArrowDown,
  IoArrowUp,
  IoCall,
  IoVideocam,
} from 'react-icons/io5';

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

function parseCallEvent(text = '') {
  if (!text.startsWith('CALL_EVENT|')) return null;

  const parts = text.split('|');
  if (parts.length < 6) return null;

  const callerId = Number(parts[2]);
  const receiverId = Number(parts[3]);

  if (!Number.isFinite(callerId) || !Number.isFinite(receiverId)) return null;

  return {
    status: parts[1],
    callerId,
    receiverId,
    durationSeconds: Number(parts[4]) || 0,
    isVideo: parts[5] === 'video',
  };
}

function currentLanguage() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.language || 'en';
  } catch (_) {
    return 'en';
  }
}

function callWord(key) {
  const language = currentLanguage();
  const words = {
    en: {
      incoming: 'Incoming call',
      outgoing: 'Outgoing call',
      missed: 'Missed call',
      canceled: 'Canceled call',
    },
    uk: {
      incoming: 'Вхідний виклик',
      outgoing: 'Вихідний виклик',
      missed: 'Пропущений виклик',
      canceled: 'Скасований виклик',
    },
    ru: {
      incoming: 'Входящий вызов',
      outgoing: 'Исходящий вызов',
      missed: 'Пропущенный вызов',
      canceled: 'Отмененный вызов',
    },
  };

  return words[language]?.[key] || words.en[key];
}

function formatCallDuration(seconds) {
  const value = Number(seconds) || 0;
  if (value <= 0) return '';

  const minutes = Math.floor(value / 60);
  const restSeconds = value % 60;

  return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
}

function callEventTitle(event, currentUserId) {
  const isOutgoing = String(event.callerId) === String(currentUserId);
  const isMissedLike = ['missed', 'rejected', 'canceled'].includes(
    event.status
  );

  if (isMissedLike) {
    return isOutgoing ? callWord('canceled') : callWord('missed');
  }

  return isOutgoing ? callWord('outgoing') : callWord('incoming');
}

function callEventAccent(event, currentUserId) {
  const isOutgoing = String(event.callerId) === String(currentUserId);
  const isMissedLike = ['missed', 'rejected', 'canceled'].includes(
    event.status
  );

  if (isMissedLike && !isOutgoing) return '#ef4444';
  if (isOutgoing) return '#2f80ed';
  return '#22c55e';
}

function CallEventBubble({
  message,
  event,
  isMine,
  currentUserId,
  onStartCall,
}) {
  const isOutgoing = String(event.callerId) === String(currentUserId);
  const accent = callEventAccent(event, currentUserId);
  const duration = formatCallDuration(event.durationSeconds);
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`message-row ${isMine ? 'mine' : 'theirs'} call-event-row`}
    >
      <div className="call-event-bubble">
        <div className="call-event-main">
          <strong>{callEventTitle(event, currentUserId)}</strong>

          <span className="call-event-meta">
            {isOutgoing ? (
              <IoArrowUp style={{ color: accent }} />
            ) : (
              <IoArrowDown style={{ color: accent }} />
            )}
            <span>{duration ? `${time}, ${duration}` : time}</span>
          </span>
        </div>

        <button
          className="call-event-action"
          type="button"
          onClick={() => onStartCall?.(event.isVideo)}
          title={event.isVideo ? 'Video call' : 'Call'}
        >
          {event.isVideo ? <IoVideocam /> : <IoCall />}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  isGroup,
  currentUserId,
  parseForwardMessage,
  parseReplyMessage,
  openMessageMenu,
  setMessageReaction,
  setOpenedImage,
  setOpenedVideo,
  onOpenUser,
  onStartCall,
  language,
  highlightedMessageId,
  onReplyTargetClick,
}) {
  const callEvent = parseCallEvent(message.text || '');

  if (callEvent && !isGroup) {
    return (
      <CallEventBubble
        message={message}
        event={callEvent}
        isMine={isMine}
        currentUserId={currentUserId}
        onStartCall={onStartCall}
      />
    );
  }

  const forwardedMessage = parseForwardMessage(message.text);
  const replyMessage = parseReplyMessage(message.text);
  const reactions = (message.reactions || []).filter(
    (item) => item.reaction && Number(item.count || 0) > 0
  );
  

  return (
  <div
    className={`message-row ${isMine ? 'mine' : 'theirs'} ${
      String(message.id) === String(highlightedMessageId)
        ? 'message-highlighted'
        : ''
    }`}
    data-message-id={message.id}
  >
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
      onDoubleClick={() => setMessageReaction?.(message, '❤️')}
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
              <span className="forward-gap">{t('forwarded_from', language)}</span>
              <strong>{forwardedMessage.name}</strong>
            </div>
          </div>

          <p>{forwardedMessage.text}</p>
        </>
      ) : replyMessage ? (
        <>
          <button
            type="button"
            className="message-reply-box"
            onClick={() => onReplyTargetClick?.(replyMessage, message)}
          >
            <strong>
              {t('replying_to', language).replace('{name}', replyMessage.name)}
            </strong>
            <span>{replyMessage.preview}</span>
          </button>

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

        {message.audio && (
          <AudioMessagePlayer
            src={message.audio}
            duration={message.audio_duration}
            isMine={isMine}
          />
        )}

        {message.file && (
          message.file_mime?.startsWith('audio/') ? (
            <AudioMessagePlayer
              src={message.file}
              duration={0}
              isMine={isMine}
            />
          ) : (
            <a
              className="message-file"
              href={getFileUrl(message.file)}
              target="_blank"
              rel="noreferrer"
            >
              <span className="message-file-icon">📄</span>
              <span>
                <strong>{message.file_name || 'File'}</strong>
                {Number(message.file_size || 0) > 0 && (
                  <small>
                    {(Number(message.file_size) / 1024 / 1024).toFixed(1)} MB
                  </small>
                )}
              </span>
            </a>
          )
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

      {reactions.length > 0 && (
        <div className="message-reactions">
          {reactions.map((item) => (
            <span
              key={item.reaction}
              className={item.reacted_by_me ? 'mine' : ''}
            >
              {item.reaction}
              {Number(item.count) > 1 ? ` ${item.count}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
);
}

export default MessageBubble;
