import { useState } from 'react';
import CreateGroupPanel from './CreateGroupPanel';
import { getFileUrl } from '../../api/fileUrl';
import { getIdentityColors } from '../../utils/identityColors';
import { IoArrowBack, IoArrowRedoOutline, IoCallOutline, IoVideocamOutline } from 'react-icons/io5';

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

function parseForwardedPreview(text = '') {
  if (!text.startsWith('FORWARDED|')) return null;
  const parts = text.split('|');
  return parts.length > 2 ? parts.slice(2).join('|').trim() : '';
}

function currentLanguage() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.language || 'en';
  } catch {
    return 'en';
  }
}

function reactionPreviewText(preview) {
  const actor = preview?.actor_name;
  const reaction = preview?.reaction;
  if (!actor || !reaction) return '';
  switch (currentLanguage()) {
    case 'uk':
      return `${actor} відреагував(ла) ${reaction} на ваше повідомлення`;
    case 'ru':
      return `${actor} поставил(а) ${reaction} на ваше сообщение`;
    default:
      return `${actor} reacted ${reaction} to your message`;
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

function callPreviewText(event, currentUserId) {
  const isOutgoing = String(event.callerId) === String(currentUserId);
  const isMissedLike = ['missed', 'rejected', 'canceled'].includes(
    event.status
  );

  let title;
  if (isMissedLike) {
    title = isOutgoing ? callWord('canceled') : callWord('missed');
  } else {
    title = isOutgoing ? callWord('outgoing') : callWord('incoming');
  }

  const duration = formatCallDuration(event.durationSeconds);
  return duration ? `${title} (${duration})` : title;
}

function ChatSidebar({
  conversations,
  selectedConv,
  onlineUsers,
  setSelectedUserId,
  setSelectedConv,
  setTypingUserId,
  setMessageMenu,
  loadMessages,
  setDeleteDialogId,
  onBack,
  setShowGroupInfo,
  setGroupInfo,
}) {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="chat-sidebar">
      {showCreateGroup && (
        <CreateGroupPanel
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={async () => {
            await window.location.reload();
          }}
        />
      )}

      <div className="chat-sidebar-content custom-scroll">
        <div className="chat-sidebar-header">
          <button className="mobile-chat-list-back-btn" onClick={onBack}>
            <IoArrowBack />
          </button>

          <div className="chat-sidebar-title-row">
            <h3>Chats</h3>

            <button
              className="create-group-open-btn"
              onClick={() => setShowCreateGroup(true)}
            >
              +
            </button>
          </div>
        </div>

        {conversations.length === 0 && (
          <p className="username">No conversations yet</p>
        )}

        {conversations.map((c) => {
          const identityColors = getIdentityColors(
            c.username || c.user_id || c.id || c.display_name
          );
          const reactionText = reactionPreviewText(c.reaction_preview);

          return (
            <div
            key={c.id}
            onClick={async () => {
              setSelectedUserId?.(null);
              setSelectedConv(c);
              setTypingUserId(null);
              setMessageMenu(null);
              setShowGroupInfo(false);
              setGroupInfo(null);

              await loadMessages(c.id, c);
            }}
            className={`chat-item ${selectedConv?.id === c.id ? 'active' : ''}`}
          >
            <div
              className={`chat-avatar-wrap ${
                onlineUsers.includes(String(c.user_id)) ? 'online' : ''
              }`}
            >
              {c.avatar ? (
                <img
                  className="chat-avatar"
                  src={getFileUrl(c.avatar)}
                  alt=""
                />
              ) : (
                <div
                  className="chat-avatar-placeholder"
                  style={{
                    backgroundColor: identityColors.background,
                    color: identityColors.foreground,
                  }}
                >
                  {c.display_name?.[0] || '?'}
                </div>
              )}
            </div>

            <div className="chat-item-content">
              <div className="chat-item-top">
                <div className="chat-list-name-row">
                  <strong>{c.display_name}</strong>

                  {onlineUsers.includes(String(c.user_id)) && (
                    <span className="chat-list-online-dot"></span>
                  )}
                </div>

                <span className="chat-badge-stack">
                  {Number(c.mention_unread_count) > 0 && (
                    <span className="mention-badge">@</span>
                  )}
                  {Number(c.unread_count) > 0 && (
                    <span className="unread-badge">{c.unread_count}</span>
                  )}
                </span>
              </div>

              {reactionText ? (
                <div className="chat-preview reaction-preview">{reactionText}</div>
              ) : c.last_message_text && (() => {
                const forwardedPreview = parseForwardedPreview(c.last_message_text);
                const callEvent = parseCallEvent(c.last_message_text);

                if (forwardedPreview !== null) {
                  return <div className="chat-preview forwarded-preview"><IoArrowRedoOutline /><span>{forwardedPreview}</span></div>;
                }

                if (callEvent) {
                  return (
                    <div className="chat-preview call-preview">
                      {callEvent.isVideo ? (
                        <IoVideocamOutline />
                      ) : (
                        <IoCallOutline />
                      )}
                      <span>{callPreviewText(callEvent, currentUser?.id)}</span>
                    </div>
                  );
                }

                return <div className="chat-preview">{c.last_message_text}</div>;
              })()}
            </div>

            {!c.is_group && !c.group_name && !c.group_id && c.type !== 'group' && (
              <button
                className="delete-dialog-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialogId(c.id);
                }}
              >
                ×
              </button>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChatSidebar;
