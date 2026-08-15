import { useRef, useState } from 'react';
import { getFileUrl } from '../../api/fileUrl';
import AudioMessagePlayer from './AudioMessagePlayer';
import { t } from '../../utils/i18n';
import { getIdentityColors, getIdentityNameColor } from '../../utils/identityColors';
import {
  IoArrowUndo,
  IoArrowDown,
  IoArrowUp,
  IoCall,
  IoVideocam,
} from 'react-icons/io5';

function SwipeReplyBubble({ children, enabled, onReply }) {
  const startPoint = useRef(null);
  const direction = useRef(null);
  const [offset, setOffset] = useState(0);

  const reset = () => {
    startPoint.current = null;
    direction.current = null;
    setOffset(0);
  };

  return (
    <div
      className="message-swipe-shell"
      style={{ transform: `translateX(${offset}px)` }}
      onTouchStart={(event) => {
        if (!enabled || event.touches.length !== 1) return;
        const touch = event.touches[0];
        startPoint.current = { x: touch.clientX, y: touch.clientY };
        direction.current = null;
      }}
      onTouchMove={(event) => {
        if (!enabled || !startPoint.current || event.touches.length !== 1) {
          return;
        }

        const touch = event.touches[0];
        const dx = touch.clientX - startPoint.current.x;
        const dy = touch.clientY - startPoint.current.y;

        if (!direction.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
          direction.current =
            dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.8
              ? 'reply'
              : 'scroll';
        }

        if (direction.current !== 'reply') return;
        event.preventDefault();
        setOffset(Math.max(-64, Math.min(0, dx)));
      }}
      onTouchEnd={() => {
        if (enabled && direction.current === 'reply' && offset <= -46) {
          navigator.vibrate?.(18);
          onReply?.();
        }
        reset();
      }}
      onTouchCancel={reset}
    >
      {children}
      <span
        className={`message-swipe-reply-icon ${offset <= -24 ? 'visible' : ''}`}
        aria-hidden="true"
      >
        <IoArrowUndo />
      </span>
    </div>
  );
}

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

function standaloneEmojiCount(text) {
  const value = text?.trim();
  if (!value) return 0;

  let count = 0;
  for (const symbol of Array.from(value)) {
    if (/\s/u.test(symbol) || /[\u200D\uFE0F\u20E3]/u.test(symbol)) {
      continue;
    }
    if (/^[\u{1F3FB}-\u{1F3FF}]$/u.test(symbol)) continue;
    if (!/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u00A9\u00AE\u203C\u2049\u2122\u2139\u3030\u303D\u3297\u3299]$/u.test(symbol)) {
      return 0;
    }
    count += 1;
  }
  return count;
}

function LinkifiedText({ text, className = '' }) {
  const urlPattern = /((?:https?:\/\/|www\.)[^\s<]+|\b(?:[a-z0-9-]+\.)+(?:com|org|net|ua|io|app|dev|info|me|co)(?:\/[^\s<]*)?)/gi;
  const isUrl = /^(?:https?:\/\/|www\.)[^\s<]+$|^(?:[a-z0-9-]+\.)+(?:com|org|net|ua|io|app|dev|info|me|co)(?:\/[^\s<]*)?$/i;
  const parts = String(text || '').split(urlPattern);

  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (!part || !isUrl.test(part)) return part;
        const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
        return (
          <a key={`${part}-${index}`} href={href} target="_blank" rel="noreferrer">
            {part}
          </a>
        );
      })}
    </p>
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

function parseGroupMemberAdded(text = '') {
  if (!text.startsWith('GROUP_MEMBER_ADDED|')) return null;

  const parts = text.split('|');
  if (parts.length < 4) return null;

  try {
    return {
      username: decodeURIComponent(parts[2]),
      name: decodeURIComponent(parts[3]) || decodeURIComponent(parts[2]),
    };
  } catch (_) {
    return null;
  }
}

function groupMemberAddedWords(language) {
  if (language === 'uk') return ['Користувач', 'був доданий'];
  if (language === 'ru') return ['Пользователь', 'был добавлен'];
  return ['User', 'was added'];
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
  onReply,
}) {
  const [showReactionDetails, setShowReactionDetails] = useState(false);
  const memberAdded = parseGroupMemberAdded(message.text || '');

  if (memberAdded && isGroup) {
    const [before, after] = groupMemberAddedWords(language);

    return (
      <div className="group-member-added-event" data-message-id={message.id}>
        <span>{before} </span>
        <button type="button" onClick={() => onOpenUser?.(memberAdded.username)}>
          {memberAdded.name}
        </button>
        <span> {after}</span>
      </div>
    );
  }

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
  const visibleText = forwardedMessage
    ? forwardedMessage.text
    : replyMessage
      ? replyMessage.text
      : message.text;
  const emojiCount = standaloneEmojiCount(visibleText);
  const emojiClass = emojiCount === 1
    ? 'emoji-only emoji-only-single'
    : emojiCount > 1
      ? 'emoji-only'
      : '';
  const reactions = (message.reactions || []).filter(
    (item) => item.reaction && Number(item.count || 0) > 0
  );
  const reactionUsers = reactions.flatMap((reaction) =>
    (reaction.users || []).map((user) => ({ ...user, reaction: reaction.reaction }))
  );
  const identityColors = getIdentityColors(
    message.username || message.sender_id || message.display_name
  );
  const messageAttachments = (
    <>
      {message.image && (
        <img
          className="message-image"
          src={getFileUrl(message.image)}
          alt=""
          onClick={() => setOpenedImage(getFileUrl(message.image))}
        />
      )}
      {message.video && (
        <div className="message-video-wrap" onClick={() => setOpenedVideo(getFileUrl(message.video))}>
          <video className="message-video" src={getFileUrl(message.video)} autoPlay muted loop playsInline />
          <div className="message-video-play">▶</div>
        </div>
      )}
      {message.audio && (
        <AudioMessagePlayer src={message.audio} duration={message.audio_duration} isMine={isMine} />
      )}
      {message.file && (
        message.file_mime?.startsWith('audio/') ? (
          <AudioMessagePlayer src={message.file} duration={0} isMine={isMine} />
        ) : (
          <a className="message-file" href={getFileUrl(message.file)} target="_blank" rel="noreferrer">
            <span className="message-file-icon">📄</span>
            <span>
              <strong>{message.file_name || 'File'}</strong>
              {Number(message.file_size || 0) > 0 && <small>{(Number(message.file_size) / 1024 / 1024).toFixed(1)} MB</small>}
            </span>
          </a>
        )
      )}
    </>
  );
  const identityNameColor = getIdentityNameColor(
    message.username || message.sender_id || message.display_name
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
        style={message.avatar ? undefined : {
          backgroundColor: identityColors.background,
          color: identityColors.foreground,
        }}
      >
        {message.avatar ? (
          <img src={getFileUrl(message.avatar)} alt="" />
        ) : (
          <span>{message.display_name?.[0] || message.username?.[0] || '?'}</span>
        )}
      </button>
    )}

    <SwipeReplyBubble enabled={isGroup} onReply={onReply}>
    <div
      className={`message-bubble ${message.image || message.video ? 'has-media' : ''} ${
        replyMessage ? 'has-reply' : ''
      } ${
        message.image || message.video ? (message.text?.trim() ? 'has-media-caption' : 'has-media-only') : ''
      }`}
      onContextMenu={(e) => openMessageMenu(e, message, isMine)}
      onDoubleClick={() => setMessageReaction?.(message, '❤️')}
    >
      {isGroup && !isMine && (
        <button
          className="group-message-author"
          style={{ color: identityNameColor }}
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

          {messageAttachments}
          {forwardedMessage.text && <LinkifiedText text={forwardedMessage.text} className={emojiClass} />}
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

              <div className="message-video-play">в–·</div>
            </div>
          )}

          {replyMessage.text && <LinkifiedText text={replyMessage.text} className={emojiClass} />}
        </>
      ) : (
        <>
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

        {message.text && <LinkifiedText text={message.text} className={emojiClass} />}
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
    {reactions.length > 0 && (
      <div className="message-reactions">
        {reactions.map((item) => (
          <button
            type="button"
            key={item.reaction}
            className={item.reacted_by_me ? 'mine' : ''}
            onClick={() => setShowReactionDetails(true)}
          >
            {item.reaction}
            {isGroup && item.users?.length ? (
              <span className="reaction-avatar-stack">
                {item.users.slice(0, 3).map((user, index) => (
                  <span
                    className="reaction-avatar"
                    key={user.user_id || user.id || index}
                    style={{ zIndex: 3 - index }}
                  >
                    {user.avatar ? (
                      <img src={getFileUrl(user.avatar)} alt="" />
                    ) : (
                      (user.display_name || user.username || '?')[0].toUpperCase()
                    )}
                  </span>
                ))}
              </span>
            ) : Number(item.count) > 1 ? ` ${item.count}` : ''}
          </button>
        ))}
      </div>
    )}
    {showReactionDetails && (
      <div className="reaction-details-backdrop" onClick={() => setShowReactionDetails(false)}>
        <section className="reaction-details-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="reaction-details-heading">
            <strong>{language === 'uk' ? 'Реакції' : language === 'ru' ? 'Реакции' : 'Reactions'}</strong>
            <button type="button" onClick={() => setShowReactionDetails(false)}>×</button>
          </div>
          {reactionUsers.map((user, index) => (
            <div className="reaction-details-user" key={`${user.user_id || user.id}-${index}`}>
              <span className="reaction-details-avatar">
                {user.avatar ? <img src={getFileUrl(user.avatar)} alt="" /> : (user.display_name || user.username || '?')[0].toUpperCase()}
              </span>
              <span>{user.display_name || user.username || 'User'}</span>
              <b>{user.reaction}</b>
            </div>
          ))}
        </section>
      </div>
    )}
    </SwipeReplyBubble>
  </div>
);
}

export default MessageBubble;
