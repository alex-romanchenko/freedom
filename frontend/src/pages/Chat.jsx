import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import socket from '../socket';
import { deleteConversationApi } from '../api/messagesApi';
import {
  FiCornerUpLeft,
  FiCopy,
  FiSend,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import EmojiPicker from 'emoji-picker-react';
import { FiImage, FiSmile } from 'react-icons/fi';
import { getFileUrl } from '../api/fileUrl';
import {   IoCallOutline, IoVideocamOutline, IoArrowBack  } from 'react-icons/io5';

function Chat({
  onUnreadCountChange,
  selectedUserId,
  setSelectedUserId,
  onOpenUser,
  audioCall,
}) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageMenu, setMessageMenu] = useState(null);
  const [showChatEmoji, setShowChatEmoji] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingOldMessages, setIsLoadingOldMessages] = useState(false);
  const [openedImage, setOpenedImage] = useState(null);
  const [deleteDialogId, setDeleteDialogId] = useState(null);

  const [typingUserId, setTypingUserId] = useState(null);
  const typingTimeoutRef = useRef(null);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastSeenMap, setLastSeenMap] = useState({});

  const [chatImage, setChatImage] = useState(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardMessageData, setForwardMessageData] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldScrollToBottomRef = useRef(false);
  const chatImageInputRef = useRef(null);
  const textareaRef = useRef(null);
  const chatEmojiRef = useRef(null);
  const joinedConversationRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem('user'));

const {
  isCalling,
  isInCall,
  isMuted,
  toggleMute,
  callStatus,
  callDuration,
  startCall,
  endCall,
  localVideoRef,
  remoteVideoRef,
  attachVideoStreams,
  isVideoCall,
} = audioCall;

  const playMessageSound = () => {
    const audio = new Audio('/sounds/message.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  const loadMessages = async (id) => {
    const res = await api.get(`/messages/${id}?limit=30`);

    shouldScrollToBottomRef.current = true;
    setMessages(res.data);
    setHasMoreMessages(res.data.length === 30);

    await api.post(`/messages/${id}/read`);

    const conversationsRes = await api.get('/messages');
    setConversations(conversationsRes.data);

    const totalUnread = conversationsRes.data.reduce((sum, conv) => {
      return sum + Number(conv.unread_count || 0);
    }, 0);

    onUnreadCountChange(totalUnread);

    if (String(joinedConversationRef.current) !== String(id)) {
      socket.emit('joinConversation', id);
      joinedConversationRef.current = id;
    }
  };

  const loadOlderMessages = async () => {
    if (
      !selectedConv ||
      messages.length === 0 ||
      isLoadingOldMessages ||
      !hasMoreMessages
    ) {
      return;
    }

    const el = messagesContainerRef.current;
    if (!el) return;

    const oldScrollHeight = el.scrollHeight;
    const oldestMessage = messages[0];

    setIsLoadingOldMessages(true);

    const res = await api.get(
      `/messages/${selectedConv.id}?before=${oldestMessage.created_at}&limit=30`
    );

    if (res.data.length < 30) {
      setHasMoreMessages(false);
    }

    setMessages((prev) => [...res.data, ...prev]);

    setTimeout(() => {
      el.scrollTop = el.scrollHeight - oldScrollHeight;
    }, 0);

    setIsLoadingOldMessages(false);
  };

  const refreshConversations = async () => {
    const res = await api.get('/messages');
    setConversations(res.data);

    const totalUnread = res.data.reduce((sum, conv) => {
      return sum + Number(conv.unread_count || 0);
    }, 0);

    onUnreadCountChange(totalUnread);

    if (!selectedConv && res.data.length > 0) {
      setSelectedConv(res.data[0]);
      await loadMessages(res.data[0].id);
    }
  };

  const deleteConversation = async (conversationId) => {
    await deleteConversationApi(conversationId);

    if (selectedConv?.id === conversationId) {
      setSelectedConv(null);
      setMessages([]);
    }

    setDeleteDialogId(null);
    await refreshConversations();
  };

  const isUserAtBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return false;

    return el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
  };

  const parseForwardMessage = (messageText) => {
    if (!messageText?.startsWith('FORWARDED|')) return null;

    const parts = messageText.split('|');

    if (parts.length < 3) return null;

    return {
      name: parts[1],
      text: parts.slice(2).join('|'),
    };
  };

  const parseReplyMessage = (messageText) => {
    if (!messageText?.startsWith('Reply to ')) {
      return null;
    }

    const lines = messageText.split('\n');
    const firstLine = lines[0];
    const realText = lines.slice(1).join('\n');

    const withoutPrefix = firstLine.replace('Reply to ', '');
    const colonIndex = withoutPrefix.indexOf(':');

    if (colonIndex === -1) return null;

    return {
      name: withoutPrefix.slice(0, colonIndex),
      preview: withoutPrefix.slice(colonIndex + 1).trim(),
      text: realText,
    };
  };

  const sendMessage = async () => {
    if ((!text.trim() && !chatImage) || !selectedConv) return;

    let finalText = text;

    if (replyTo) {
      const parsedReply = parseReplyMessage(replyTo.text);
      const cleanPreview = parsedReply ? parsedReply.text : replyTo.text;

      finalText = `Reply to ${replyTo.display_name}: ${cleanPreview.slice(
        0,
        80
      )}\n${text}`;
    }

    const formData = new FormData();
    formData.append('text', finalText);

    if (chatImage) {
      formData.append('image', chatImage);
    }

    shouldScrollToBottomRef.current = true;

    await api.post(`/messages/${selectedConv.user_id}`, formData);

    socket.emit('stopTyping', {
      conversationId: selectedConv.id,
      userId: currentUser.id,
    });

    setText('');
    setReplyTo(null);
    setChatImage(null);

    if (chatImageInputRef.current) {
      chatImageInputRef.current.value = '';
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await refreshConversations();
  };

  const deleteMessage = async () => {
    const messageId = messageMenu.message.id;

    await api.delete(`/messages/message/${messageId}`);
    closeMessageMenu();

    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    const res = await api.get('/messages');
    setConversations(res.data);

    const totalUnread = res.data.reduce((sum, conv) => {
      return sum + Number(conv.unread_count || 0);
    }, 0);

    onUnreadCountChange(totalUnread);
  };

  const startEditMessage = () => {
    setEditingMessage(messageMenu.message);
    setText(messageMenu.message.text);
    closeMessageMenu();

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const saveEditedMessage = async () => {
    if (!editingMessage || !text.trim()) return;

    const res = await api.put(`/messages/message/${editingMessage.id}`, {
      text,
    });

    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingMessage.id ? { ...m, text: res.data.text } : m
      )
    );

    setEditingMessage(null);
    setText('');

    const conversationsRes = await api.get('/messages');
    setConversations(conversationsRes.data);

    const totalUnread = conversationsRes.data.reduce((sum, conv) => {
      return sum + Number(conv.unread_count || 0);
    }, 0);

    onUnreadCountChange(totalUnread);
  };

  const startReply = () => {
    setReplyTo(messageMenu.message);
    closeMessageMenu();

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const forwardMessage = () => {
    setForwardMessageData(messageMenu.message);
    closeMessageMenu();
  };

  const openMessageMenu = (e, message, isMine) => {
    e.preventDefault();

    const screenMiddle = window.innerHeight / 2;
    const openUp = e.clientY > screenMiddle;

    setMessageMenu({
      message,
      isMine,
      x: e.clientX,
      y: e.clientY,
      openUp,
    });
  };

  const closeMessageMenu = () => {
    setMessageMenu(null);
  };

  const sendForwardMessage = async (conversation) => {
    if (!forwardMessageData) return;

    await api.post(`/messages/${conversation.user_id}`, {
      text: `FORWARDED|${forwardMessageData.display_name}|${forwardMessageData.text}`,
    });

    setForwardMessageData(null);

    await refreshConversations();

    if (selectedConv?.id === conversation.id) {
      await loadMessages(conversation.id);
    }
  };

  const copyMessageText = async () => {
    if (!messageMenu?.message?.text) return;

    await navigator.clipboard.writeText(messageMenu.message.text);
    closeMessageMenu();
  };

  const handleDragOver = (e) => {
  e.preventDefault();
  setIsDraggingImage(true);
};

const handleDragLeave = (e) => {
  e.preventDefault();
  setIsDraggingImage(false);
};

const handleDropImage = (e) => {
  e.preventDefault();
  setIsDraggingImage(false);

  const file = e.dataTransfer.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('image/')) return;

  setChatImage(file);
};

  const handlePasteImage = (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        setChatImage(file);
      }
    }
  }
};

  const handleTextChange = (e) => {
    setText(e.target.value);

    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';

    if (!selectedConv?.id || !currentUser?.id) return;

    socket.emit('typing', {
      conversationId: selectedConv.id,
      userId: currentUser.id,
    });

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', {
        conversationId: selectedConv.id,
        userId: currentUser.id,
      });
    }, 1200);
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();

    const diffMinutes = Math.floor(diffMs / 1000 / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMinutes < 1) return 'last seen just now';
    if (diffMinutes < 60) return `last seen ${diffMinutes} min ago`;
    if (diffHours < 24) return `last seen ${diffHours} h ago`;
    if (diffDays < 30) return `last seen ${diffDays} d ago`;

    return `last seen ${diffMonths} mo ago`;
  };

  const getChatStatus = () => {
    if (!selectedConv) return '';

    const userId = String(selectedConv.user_id);

    if (String(typingUserId) === userId) {
      return 'typing...';
    }

    if (onlineUsers.includes(userId)) {
      return 'online';
    }

    return formatLastSeen(lastSeenMap[userId] || selectedConv.last_seen);
  };

  useEffect(() => {
  if (isInCall) {
    setTimeout(() => {
      attachVideoStreams();
    }, 100);
  }
}, [isInCall, attachVideoStreams]);

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    if (!selectedUserId || conversations.length === 0) return;

    const conv = conversations.find(
      (c) => String(c.user_id) === String(selectedUserId)
    );

    if (!conv) return;

    if (String(selectedConv?.id) === String(conv.id)) return;

    setSelectedConv(conv);
    loadMessages(conv.id);
  }, [selectedUserId, conversations, selectedConv?.id]);

  useEffect(() => {
    const handleClickOutsideEmoji = (e) => {
      if (
        showChatEmoji &&
        chatEmojiRef.current &&
        !chatEmojiRef.current.contains(e.target)
      ) {
        setShowChatEmoji(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideEmoji);

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideEmoji);
    };
  }, [showChatEmoji]);

  useEffect(() => {
    const handleTyping = ({ conversationId, userId }) => {
      if (
        String(conversationId) === String(selectedConv?.id) &&
        String(userId) !== String(currentUser?.id)
      ) {
        setTypingUserId(String(userId));
      }
    };

    const handleStopTyping = ({ conversationId, userId }) => {
      if (
        String(conversationId) === String(selectedConv?.id) &&
        String(userId) !== String(currentUser?.id)
      ) {
        setTypingUserId(null);
      }
    };

    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);

    return () => {
      socket.off('typing', handleTyping);
      socket.off('stopTyping', handleStopTyping);
    };
  }, [selectedConv?.id, currentUser?.id]);

  useEffect(() => {
    const handleOnlineUsers = ({ users }) => {
      setOnlineUsers(users.map(String));
    };

    

    const handleUserOnline = ({ userId }) => {
      const id = String(userId);

      setOnlineUsers((prev) => {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      });
    };

    const handleUserOffline = ({ userId, lastSeen }) => {
      const id = String(userId);

      setOnlineUsers((prev) => prev.filter((item) => item !== id));

      setLastSeenMap((prev) => ({
        ...prev,
        [id]: lastSeen,
      }));
    };

    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);

    socket.emit('getOnlineUsers');

    return () => {
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
    };
  }, []);

  useEffect(() => {
    function handleNewMessage(data) {
      const isMyMessage =
        String(data.message.sender_id) === String(currentUser?.id);

      if (!isMyMessage) {
        playMessageSound();
      }

      if (String(data.conversationId) === String(selectedConv?.id)) {
        shouldScrollToBottomRef.current = true;

        setMessages((prev) => [...prev, data.message]);

        api.post(`/messages/${data.conversationId}/read`).then(() => {
          refreshConversations();
        });
      } else {
        refreshConversations();
      }
    }

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [selectedConv, currentUser?.id]);

  useEffect(() => {
  const handleMessagesRead = ({ conversationId, messageIds }) => {
    if (String(conversationId) !== String(selectedConv?.id)) return;

    setMessages((prev) =>
      prev.map((message) =>
        messageIds.includes(message.id)
          ? { ...message, status: 'read' }
          : message
      )
    );
  };

  socket.on('messagesRead', handleMessagesRead);

  return () => {
    socket.off('messagesRead', handleMessagesRead);
  };
}, [selectedConv?.id]);

useEffect(() => {
  const handleMessagesDelivered = ({ conversationId, messageIds }) => {
    if (String(conversationId) !== String(selectedConv?.id)) return;

    setMessages((prev) =>
      prev.map((message) =>
        messageIds.includes(message.id) && message.status === 'sent'
          ? { ...message, status: 'delivered' }
          : message
      )
    );
  };

  socket.on('messagesDelivered', handleMessagesDelivered);

  return () => {
    socket.off('messagesDelivered', handleMessagesDelivered);
  };
}, [selectedConv?.id]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    if (shouldScrollToBottomRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
        shouldScrollToBottomRef.current = false;
      });

      return;
    }

    if (isUserAtBottom()) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  const MessageStatus = ({ status }) => {
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
};

  return (
      <div
        className={`chat-layout ${selectedConv ? 'chat-open' : ''} ${
          isDraggingImage ? 'dragging-image' : ''
        }`}
        onClick={closeMessageMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropImage}
      >
      <div className="chat-sidebar">
        <h3>Chats</h3>

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

            <button
              className="delete-dialog-btn"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogId(c.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="chat-window">
        {selectedConv ? (
          <>
            <div className="chat-header">
              <button
                className="mobile-back-btn"
                onClick={() => setSelectedConv(null)}
              >
                <IoArrowBack />
              </button>
                <div
                  onClick={() => onOpenUser(selectedConv.username)}
                  style={{ cursor: 'pointer' }}
                >
                  {selectedConv.avatar ? (
                    <img
                      className="chat-header-avatar"
                      src={getFileUrl(selectedConv.avatar)}
                      alt=""
                    />
                  ) : (
                    <div className="chat-header-avatar-placeholder">
                      {selectedConv.display_name?.[0] || '?'}
                    </div>
                  )}
                </div>


                <div className="chat-header-info">
                  <div
                    className="chat-header-name"
                    onClick={() => onOpenUser(selectedConv.username)}
                    style={{ cursor: 'pointer' }}
                  >
                    {selectedConv.display_name}
                  </div>

                  <span
                    className={`chat-header-status ${
                      getChatStatus() === 'online' ? 'online' : ''
                    }`}
                  >
                    {getChatStatus()}
                  </span>
                </div>
                {isInCall || isCalling ? (
                  <button className="call-btn active" onClick={endCall}>
                    ×
                  </button>
                ) : (
                  <>
                    <button
                      className="call-btn"
                      onClick={() => startCall(selectedConv.user_id, false)}
                    >
                      <IoCallOutline />
                    </button>

                    <button
                      className="call-btn"
                      onClick={() => startCall(selectedConv.user_id, true)}
                    >
                      <IoVideocamOutline />
                    </button>
                  </>
                )}
                {callStatus && (
                <div className="call-status">
                  <span>{callStatus}</span>

                  {isInCall && (
                    <span className="call-timer">
                      {String(Math.floor(callDuration / 60)).padStart(2, '0')}
                      :
                      {String(callDuration % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
                
              )}
              {isInCall && (
              <button
                className={`mute-btn ${isMuted ? 'muted' : ''}`}
                onClick={toggleMute}
              >
                {isMuted ? 'Mic off' : 'Mic on'}
              </button>
            )}
              </div>
                      {isInCall && isVideoCall && (
            <div className="video-call-box">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />

              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
              />
            </div>
          )}
            <div
              className="messages-list"
              ref={messagesContainerRef}
              onScroll={(e) => {
                if (e.currentTarget.scrollTop < 40) {
                  loadOlderMessages();
                }
              }}
            >
              {messages.map((m) => {
                const isMine = String(m.sender_id) === String(currentUser?.id);

                return (
                  <div
                    key={m.id}
                    className={`message-row ${isMine ? 'mine' : 'theirs'}`}
                  >
                    <div
                      className="message-bubble"
                      onContextMenu={(e) => openMessageMenu(e, m, isMine)}
                    >
                      {parseForwardMessage(m.text) ? (
                        <>
                          <div className="message-forward-box">
                            <div>
                              <span className="forward-gap">Forwarded from</span>
                              <strong>{parseForwardMessage(m.text).name}</strong>
                            </div>
                          </div>

                          <p>{parseForwardMessage(m.text).text}</p>
                        </>
                      ) : parseReplyMessage(m.text) ? (
                        <>
                          <div className="message-reply-box">
                            <strong>{parseReplyMessage(m.text).name}</strong>
                            <span>{parseReplyMessage(m.text).preview}</span>
                          </div>

                          <p>{parseReplyMessage(m.text).text}</p>
                        </>
                      ) : (
                        <>
                          {m.text && <p>{m.text}</p>}

                          {m.image && (
                            <img
                              className="message-image"
                              src={getFileUrl(m.image)}
                              alt=""
                              onClick={() => setOpenedImage(getFileUrl(m.image))}
                            />
                          )}
                        </>
                      )}

                    <span className="message-meta">
                      <span className="message-time">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {isMine && <MessageStatus status={m.status} />}
                    </span>
                    </div>
                  </div>
                );
              })}

              {forwardMessageData && (
                <div className="modal-overlay">
                  <div className="forward-popup">
                    <h3>Forward message</h3>

                    {conversations.filter((c) => c.id !== selectedConv?.id)
                      .length === 0 ? (
                      <p className="username">
                        No other conversations to forward this message.
                      </p>
                    ) : (
                      <div className="forward-list">
                        {conversations
                          .filter((c) => c.id !== selectedConv?.id)
                          .map((conversation) => (
                            <button
                              key={conversation.id}
                              className="forward-user"
                              onClick={() => sendForwardMessage(conversation)}
                            >
                              {conversation.avatar ? (
                                <img
                                  src={getFileUrl(conversation.avatar)}
                                  alt=""
                                />
                              ) : (
                                <div className="forward-avatar-placeholder">
                                  {conversation.display_name?.[0] || '?'}
                                </div>
                              )}

                              <span>{conversation.display_name}</span>
                            </button>
                          ))}
                      </div>
                    )}

                    <button
                      className="secondary-btn"
                      onClick={() => setForwardMessageData(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {messageMenu && (
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
              )}

              <div ref={messagesEndRef} />
            </div>

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

            {chatImage && (
              <div className="chat-image-preview">
                <img src={URL.createObjectURL(chatImage)} alt="" />

                <button onClick={() => setChatImage(null)}>×</button>
              </div>
            )}

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
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];

                    if (!file) return;

                    setChatImage(file);
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

                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChatEmoji((prev) => !prev);
                  }}
                >
                  <FiSmile />
                </button>
              </div>

              <button
                type="button"
                className="chat-send-btn"
                disabled={!text.trim() && !chatImage}
                onClick={editingMessage ? saveEditedMessage : sendMessage}
              >
                <FiSend />
              </button>
            </div>

            {openedImage && (
              <div
                className="image-preview-overlay"
                onClick={() => setOpenedImage(null)}
              >
                <img src={openedImage} alt="" />
              </div>
            )}

            {showChatEmoji && (
              <div
                className="chat-emoji-picker"
                ref={chatEmojiRef}
                onClick={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setText((prev) => prev + emojiData.emoji);
                  }}
                  height={350}
                  width={300}
                />
              </div>
            )}
          </>
        ) : (
          <p>Select a chat</p>
        )}
      </div>

      {deleteDialogId && (
        <div className="modal-overlay">
          <div className="delete-chat-popup">
            <h3>Are you sure?</h3>
            <p>This chat will be deleted.</p>

            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => setDeleteDialogId(null)}
              >
                Cancel
              </button>

              <button
                className="primary-btn"
                onClick={() => deleteConversation(deleteDialogId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Chat;