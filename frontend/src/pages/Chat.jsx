import MessageBubble from './chat/MessageBubble';
import { createPortal } from 'react-dom';
import ChatHeader from './chat/ChatHeader';
import MediaPreviewModal from './chat/MediaPreviewModal';
import ChatInput from './chat/ChatInput';
import ForwardModal from './chat/ForwardModal';
import MessageContextMenu from './chat/MessageContextMenu';
import ChatSidebar from './chat/ChatSidebar';
import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import socket from '../socket';
import { deleteConversationApi } from '../api/messagesApi';
import GroupInfoPanel from './chat/GroupInfoPanel';
import {
  IoMic,
  IoMicOff,
  IoVideocam,
  IoVideocamOff,
  IoExpand,
  IoCall,
  IoCameraReverseOutline,
  IoArrowDown,
} from 'react-icons/io5';

function Chat({
  onUnreadCountChange,
  selectedUserId,
  setSelectedUserId,
  selectedConversationId,
  setSelectedConversationId,
  onOpenUser,
  audioCall,
  onBackToHome,
}) {
  const [conversations, setConversations] = useState([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [selectedConv, setSelectedConv] = useState(null);
  const [isFakeFullscreen, setIsFakeFullscreen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageMenu, setMessageMenu] = useState(null);
  const [showChatEmoji, setShowChatEmoji] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingOldMessages, setIsLoadingOldMessages] = useState(false);
  const [openedImage, setOpenedImage] = useState(null);
  const [openedVideo, setOpenedVideo] = useState(null);
  const [deleteDialogId, setDeleteDialogId] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const [typingUserId, setTypingUserId] = useState(null);
  const typingTimeoutRef = useRef(null);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastSeenMap, setLastSeenMap] = useState({});

  const [chatFile, setChatFile] = useState(null);
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
  const videoCallBoxRef = useRef(null);

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
  isCameraOff,
  toggleCamera,
  switchCamera,
} = audioCall;

const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({
    behavior: 'smooth',
  });

  setShowScrollButton(false);
};

const handleGroupDeletedOrLeft = async () => {
  setSelectedConv(null);
  setMessages([]);
  setShowGroupInfo(false);
  setGroupInfo(null);

  await refreshConversations();
};

  const playMessageSound = () => {
    const audio = new Audio('/sounds/message.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  const openGroupInfo = async () => {
  if (selectedConv?.type !== 'group') return;

  const res = await api.get(`/group-chats/${selectedConv.id}`);

  setGroupInfo(res.data);
  setShowGroupInfo(true);
};
const toggleFullscreen = () => {
  const el = videoCallBoxRef.current;

  if (!el) return;

  const isIPhone = /iPhone|iPod/.test(navigator.userAgent);

  if (isIPhone) {
    setIsFakeFullscreen((prev) => !prev);
    return;
  }

  if (!document.fullscreenElement) {
    el.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
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

    const isCompactChat =
      window.innerWidth <= 768 ||
      (window.innerWidth <= 1024 && window.matchMedia('(orientation: portrait)').matches);

    if (!selectedConv && res.data.length > 0 && !isCompactChat) {
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
    if ((!text.trim() && !chatFile) || !selectedConv) return;

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

    if (chatFile) {
      formData.append('image', chatFile);
    }

    shouldScrollToBottomRef.current = true;

    const messageUrl =
      selectedConv.type === 'group'
        ? `/messages/group/${selectedConv.id}`
        : `/messages/${selectedConv.user_id}`;

    await api.post(messageUrl, formData);

    socket.emit('stopTyping', {
      conversationId: selectedConv.id,
      userId: currentUser.id,
    });

    setText('');
    setReplyTo(null);
    setChatFile(null);

    if (chatImageInputRef.current) {
      chatImageInputRef.current.value = '';
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await refreshConversations();
  };

const sendAudioMessage = async (audioBlob, audioDuration) => {
  if (!selectedConv) return;

  shouldScrollToBottomRef.current = true;

  const formData = new FormData();

const extension = audioBlob.fileExtension || 'webm';

formData.append(
  'audio',
  audioBlob,
  `voice-message.${extension}`
);

  formData.append(
    'audioDuration',
    audioDuration
  );

  const url =
    selectedConv.type === 'group'
      ? `/messages/group-audio/${selectedConv.id}`
      : `/messages/audio/${selectedConv.user_id}`;

  await api.post(url, formData);

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

const handleDropFile = (e) => {
  e.preventDefault();
  setIsDraggingImage(false);

  const file = e.dataTransfer.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;

  setChatFile(file);
};

  const handlePasteImage = (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        setChatFile(file);
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
  if (!isInCall) return;

  setTimeout(() => {
    attachVideoStreams();
  }, 100);
}, [isInCall, isFakeFullscreen, attachVideoStreams]);

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
  if (!selectedConversationId || conversations.length === 0) return;

  const conv = conversations.find(
    (c) => String(c.id) === String(selectedConversationId)
  );

  if (!conv) return;

  if (String(selectedConv?.id) === String(conv.id)) return;

  setSelectedConv(conv);
  loadMessages(conv.id);
  setSelectedConversationId?.(null);
}, [selectedConversationId, conversations, selectedConv?.id]);

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

  const videoCallContent =
  isInCall && isVideoCall ? (
    <div
      className={`video-call-box ${
        isFakeFullscreen ? 'fake-fullscreen' : ''
      }`}
      ref={videoCallBoxRef}
    >
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
        className={`local-video ${isCameraOff ? 'hidden' : ''}`}
      />

      <div className="video-call-controls">
        <button
          className={`video-control-btn ${isMuted ? 'active' : ''}`}
          onClick={toggleMute}
        >
          {isMuted ? <IoMicOff /> : <IoMic />}
        </button>

        <button
          className={`video-control-btn ${
            isCameraOff ? 'active' : ''
          }`}
          onClick={toggleCamera}
        >
          {isCameraOff ? <IoVideocamOff /> : <IoVideocam />}
        </button>

          {window.innerWidth <= 1024 && (
    <button
      className="video-control-btn"
      onClick={switchCamera}
    >
      <IoCameraReverseOutline />
    </button>
  )}

        <button
          className="video-control-btn"
          onClick={toggleFullscreen}
        >
          <IoExpand />
        </button>

        <button
          className="video-control-btn end-call-btn"
          onClick={endCall}
        >
          <IoCall />
        </button>
      </div>
    </div>
  ) : null;
  

  return (
    
      <div
        className={`chat-layout
          ${selectedConv ? 'chat-open' : ''}
          ${isDraggingImage ? 'dragging-image' : ''}
          ${showGroupInfo ? 'with-group-info' : ''}
        `}
        onClick={closeMessageMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropFile}
      >
      <ChatSidebar
          conversations={conversations}
          selectedConv={selectedConv}
          onlineUsers={onlineUsers}
          setSelectedUserId={setSelectedUserId}
          setSelectedConv={setSelectedConv}
          setTypingUserId={setTypingUserId}
          setMessageMenu={setMessageMenu}
          loadMessages={loadMessages}
          setDeleteDialogId={setDeleteDialogId}
          onBack={onBackToHome}
          setShowGroupInfo={setShowGroupInfo}
          setGroupInfo={setGroupInfo}
        />
      <div className="chat-window">
        {selectedConv ? (
          <>
           <ChatHeader
              selectedConv={selectedConv}
              onOpenUser={onOpenUser}
              onOpenGroupInfo={openGroupInfo}
              getChatStatus={getChatStatus}
              isInCall={isInCall}
              isCalling={isCalling}
              endCall={endCall}
              startCall={startCall}
              callStatus={callStatus}
              callDuration={callDuration}
              isMuted={isMuted}
              toggleMute={toggleMute}
              switchCamera={switchCamera}
              setSelectedConv={setSelectedConv}
              isVideoCall={isVideoCall}
            />
            {!isFakeFullscreen && videoCallContent}
            <div
              className="messages-list custom-scroll"
              ref={messagesContainerRef}
              onScroll={(e) => {
                const el = e.currentTarget;

                const distanceFromBottom =
                  el.scrollHeight - el.scrollTop - el.clientHeight;

                setShowScrollButton(distanceFromBottom > 250);

                if (el.scrollTop < 40) {
                  loadOlderMessages();
                }
              }}
            >
              {messages.map((m) => {
              const isMine = String(m.sender_id) === String(currentUser?.id);

              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={isMine}
                  isGroup={selectedConv?.type === 'group'}
                  onOpenUser={onOpenUser}
                  parseForwardMessage={parseForwardMessage}
                  parseReplyMessage={parseReplyMessage}
                  openMessageMenu={openMessageMenu}
                  setOpenedImage={setOpenedImage}
                  setOpenedVideo={setOpenedVideo}
                />
              );
            })}

              <ForwardModal
                forwardMessageData={forwardMessageData}
                conversations={conversations}
                selectedConv={selectedConv}
                sendForwardMessage={sendForwardMessage}
                setForwardMessageData={setForwardMessageData}
              />

             <MessageContextMenu
                messageMenu={messageMenu}
                startReply={startReply}
                copyMessageText={copyMessageText}
                forwardMessage={forwardMessage}
                startEditMessage={startEditMessage}
                deleteMessage={deleteMessage}
              />

              <div ref={messagesEndRef} />
            </div>

           <ChatInput
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                editingMessage={editingMessage}
                setEditingMessage={setEditingMessage}
                setText={setText}
                text={text}
                chatFile={chatFile}
                setChatFile={setChatFile}
                chatImageInputRef={chatImageInputRef}
                textareaRef={textareaRef}
                handleTextChange={handleTextChange}
                handlePasteImage={handlePasteImage}
                showChatEmoji={showChatEmoji}
                setShowChatEmoji={setShowChatEmoji}
                chatEmojiRef={chatEmojiRef}
                parseReplyMessage={parseReplyMessage}
                saveEditedMessage={saveEditedMessage}
                sendMessage={sendMessage}
                sendAudioMessage={sendAudioMessage}
              />

          <MediaPreviewModal
              openedImage={openedImage}
              setOpenedImage={setOpenedImage}
              openedVideo={openedVideo}
              setOpenedVideo={setOpenedVideo}
            />
          </>
        ) : (
          <p>Select a chat</p>
        )}
      </div>
      {showScrollButton && (
  <button
    className="scroll-to-bottom-btn"
    onClick={scrollToBottom}
  >
    <IoArrowDown  />
  </button>
)}

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

      {showGroupInfo && (
        
        <GroupInfoPanel
          groupInfo={groupInfo}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          onClose={() => setShowGroupInfo(false)}
          onOpenUser={onOpenUser}
          onGroupDeletedOrLeft={handleGroupDeletedOrLeft}
        />
      )}
      {isFakeFullscreen && videoCallContent &&
        createPortal(videoCallContent, document.body)}
    </div>
  );
}

export default Chat;