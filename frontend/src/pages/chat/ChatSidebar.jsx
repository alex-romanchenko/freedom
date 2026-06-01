import { useState } from 'react';
import CreateGroupPanel from './CreateGroupPanel';
import { getFileUrl } from '../../api/fileUrl';
import {  IoArrowBack } from 'react-icons/io5';
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
    <div className="chat-sidebar-header">
        <button
        className="mobile-chat-list-back-btn"
        onClick={onBack}
        >
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

      {conversations.map((c) => (
        <div
          key={c.id}
          onClick={async () => {
            setSelectedUserId?.(null);
            setSelectedConv(c);
            setTypingUserId(null);
            setMessageMenu(null);
            setShowGroupInfo(false);
            setGroupInfo(null);

            await loadMessages(c.id);
          }}
          className={`chat-item ${selectedConv?.id === c.id ? 'active' : ''}`}
        >
          <div
            className={`chat-avatar-wrap ${
              onlineUsers.includes(String(c.user_id)) ? 'online' : ''
            }`}
          >
            {c.avatar ? (
              <img className="chat-avatar" src={getFileUrl(c.avatar)} alt="" />
            ) : (
              <div className="chat-avatar-placeholder">
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

              {Number(c.unread_count) > 0 && (
                <span className="unread-badge">{c.unread_count}</span>
              )}
            </div>

            {c.last_message_text && (
              <div className="chat-preview">{c.last_message_text}</div>
            )}
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
      ))}
    </div>
  );
}

export default ChatSidebar;