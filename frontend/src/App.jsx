import { useEffect, useRef, useState } from 'react';
import api from './api/api';
import socket from './socket';

import Feed from './pages/Feed';
import { useLocation, useNavigate } from 'react-router-dom';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import UserSearch from './components/UserSearch';
import Friends from './pages/Friends';
import Favorites from './pages/Favorites';
import ResetPassword from './pages/ResetPassword';
import UserProfile from './pages/UserProfile';
import WhoToFollow from './components/WhoToFollow';
import PopularPosts from './components/PopularPosts';
import Auth from './pages/Auth';
import Photos from './pages/Photos';
import PostDetails from './pages/PostDetails';
import Notifications from './pages/Notifications';
import NotificationPopup from './components/NotificationPopup';
import PhotoModal from './components/PhotoModal';
import { getPostByIdApi } from './api/postsApi';
import { getPhotoByIdApi } from './api/photosApi';
import VerifyEmail from "./pages/VerifyEmail";
import { useAudioCall } from './hooks/useAudioCall';
import { getFileUrl } from './api/fileUrl';
import { getStoredLanguage, t } from './utils/i18n';


import {
  IoHome,
  IoHomeOutline,
  IoPeople,
  IoPeopleOutline,
  IoChatbubbleEllipses,
  IoChatbubbleEllipsesOutline,
  IoHeart,
  IoHeartOutline,
  IoPerson,
  IoPersonOutline,
  IoLogOutOutline,
  IoNotifications,
  IoNotificationsOutline,
  IoArrowBack,
} from 'react-icons/io5';

import { getIncomingRequestsApi } from './api/followApi';
import { getNotificationsApi } from './api/notificationsApi';

import './App.css';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isAuth, setIsAuth] = useState(() =>
    Boolean(localStorage.getItem('token') || sessionStorage.getItem('token'))
  );

  const getPageFromPath = (path) => {
  if (path === '/friends') return 'friends';
  if (path === '/messages') return 'chat';
  if (path === '/actions') return 'notifications';
  if (path === '/favorites') return 'favorites';
  if (path === '/profile') return 'profile';
  if (path === '/user') return 'userProfile';
  if (path === '/photos') return 'photos';

  return 'feed';
};

const [page, setPageState] = useState(() =>
  getPageFromPath(window.location.pathname)
);

const setPage = (nextPage) => {
  const paths = {
    feed: '/',
    friends: '/friends',
    chat: '/messages',
    notifications: '/actions',
    favorites: '/favorites',
    profile: '/profile',
    userProfile: '/user',
    photos: '/photos',
  };

  setPageState(nextPage);

  const nextPath = paths[nextPage] || '/';

  if (location.pathname !== nextPath) {
    navigate(nextPath);
  }
};
  const [friendRequestSignal, setFriendRequestSignal] = useState(0);
  const [friendPopup, setFriendPopup] = useState(null);
  const [friendAcceptedPopup, setFriendAcceptedPopup] = useState(null);
  const [commentPopup, setCommentPopup] = useState(null);
  const [likePopup, setLikePopup] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [friendsUsername, setFriendsUsername] = useState(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [popupMessage, setPopupMessage] = useState(null);
  const [popupPhoto, setPopupPhoto] = useState(null);
  const [viewUsername, setViewUsername] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [photosUserId, setPhotosUserId] = useState(null);
  const [language, setLanguage] = useState(getStoredLanguage());
  const joinedSocketRef = useRef(null);
  const videoCallBoxRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem('user'));

const audioCall = useAudioCall(currentUser?.id);
const {
  incomingCall,
  remoteAudioRef,
  ringtoneRef,
  acceptCall,
  rejectCall,
} = audioCall;

const handleAcceptCall = async () => {
  if (!incomingCall) return;

  const callerId = incomingCall.from;

  setActivePost(null);
  setSelectedConversationId(null);
  setSelectedUserId(callerId);
  setPage('chat');

  await acceptCall();
};

 const path = location.pathname;

const isResetPasswordPage = path === '/reset-password';
const isVerifyEmailPage = path === '/verify-email';

  const playNotificationSound = () => {
    const audio = new Audio('/sounds/message.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  const refreshUnreadCount = async () => {
    try {
      const res = await api.get('/messages');
      const totalUnread = res.data.reduce((sum, conv) => {
        return sum + Number(conv.unread_count || 0);
      }, 0);

      setUnreadMessagesCount(totalUnread);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshFriendRequestsCount = async () => {
    try {
      const data = await getIncomingRequestsApi();

      setFriendRequestsCount(
        data.filter((r) => r.seen_by_following === false).length
      );
    } catch (err) {
      console.error(err);
    }
  };

  const refreshNotificationsCount = async () => {

    try {
      const data = await getNotificationsApi();

      setNotificationsCount(
        data.filter((item) => item.is_read === false).length
      );
    } catch (err) {
      console.error(err);
    }
  };
  
  useEffect(() => {
  if (!isAuth) return;

  const currentUser = JSON.parse(localStorage.getItem('user'));
  if (!currentUser?.id) return;

  const userId = String(currentUser.id);

  const emitAppState = () => {
    if (!socket.connected) return;
    socket.emit('appState', {
      foreground: document.visibilityState === 'visible',
    });
  };

  const join = () => {
    const key = `${userId}:${socket.id}`;

    if (joinedSocketRef.current === key) return;

    socket.emit('joinUser', userId);
    joinedSocketRef.current = key;
    emitAppState();
  };

  if (!socket.connected) {
    socket.connect();
  } else {
    join();
  }

  socket.on('connect', join);
  document.addEventListener('visibilitychange', emitAppState);

  return () => {
    socket.off('connect', join);
    document.removeEventListener('visibilitychange', emitAppState);
  };
}, [isAuth]);

useEffect(() => {
  if (location.pathname === '/reset-password') return;
  if (location.pathname === '/verify-email') return;

  setPageState(getPageFromPath(location.pathname));
}, [location.pathname]);

useEffect(() => {
  if (!isAuth) return;

    refreshUnreadCount();
    refreshFriendRequestsCount();
    refreshNotificationsCount();

    function handleNewMessage(data) {
  refreshUnreadCount();

  if (page === 'chat') return;

  playNotificationSound();

  if (data.group) {
    setPopupMessage({
      isGroup: true,

      group_name: data.group.group_name,
      group_avatar: data.group.group_avatar,

      sender_name: data.message.display_name,
      sender_id: data.message.sender_id,

      conversationId: data.conversationId,

      text: data.message.text,
    });
  } else {
    setPopupMessage(data.message);
  }

  setTimeout(() => {
    setPopupMessage(null);
  }, 10000);
}

    function handleNewComment(data) {
      const currentUser = JSON.parse(localStorage.getItem('user'));

      if (!currentUser || Number(currentUser.id) !== Number(data.ownerId)) return;

      setNotificationsCount((prev) => prev + 1);
      playNotificationSound();
      setCommentPopup(data);

      setTimeout(() => {
        setCommentPopup(null);
      }, 10000);
    }

    function handleNewFriendRequest(data) {
      const currentUser = JSON.parse(localStorage.getItem('user'));

      if (!currentUser || Number(currentUser.id) !== Number(data.ownerId)) return;

      setFriendRequestsCount((prev) => prev + 1);
      setNotificationsCount((prev) => prev + 1);
      setFriendRequestSignal((prev) => prev + 1);

      playNotificationSound();
      setFriendPopup(data.sender);

      setTimeout(() => {
        setFriendPopup(null);
      }, 6000);
    }

    function handleFriendRequestAccepted(data) {
      const currentUser = JSON.parse(localStorage.getItem('user'));

      if (!currentUser || Number(currentUser.id) !== Number(data.ownerId)) return;

      setNotificationsCount((prev) => prev + 1);

      playNotificationSound();
      setFriendAcceptedPopup(data.sender);

      setTimeout(() => {
        setFriendAcceptedPopup(null);
      }, 6000);
    }

    function handleGroupAdded() {
      setNotificationsCount((prev) => prev + 1);
      playNotificationSound();
    }

    function handleGroupRemoved() {
      setNotificationsCount((prev) => prev + 1);
      playNotificationSound();
    }

    function handleNewLike(data) {
      const currentUser = JSON.parse(localStorage.getItem('user'));

      if (!currentUser || Number(currentUser.id) !== Number(data.ownerId)) return;

      setNotificationsCount((prev) => prev + 1);
      playNotificationSound();
      setLikePopup(data);

      setTimeout(() => {
        setLikePopup(null);
      }, 10000);
    }

    socket.on('newMessage', handleNewMessage);
    socket.on('newLike', handleNewLike);
    socket.on('newComment', handleNewComment);
    socket.on('newFriendRequest', handleNewFriendRequest);
    socket.on('newFriendRequestAccepted', handleFriendRequestAccepted);
    socket.on('groupAdded', handleGroupAdded);
    socket.on('groupRemoved', handleGroupRemoved);
 

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('newLike', handleNewLike);
      socket.off('newComment', handleNewComment);
      socket.off('newFriendRequest', handleNewFriendRequest);
      socket.off('newFriendRequestAccepted', handleFriendRequestAccepted);
      socket.off('groupAdded', handleGroupAdded);
      socket.off('groupRemoved', handleGroupRemoved);

    };
  }, [isAuth, page]);

  useEffect(() => {
    if (!isAuth) {
      setShowLogoutConfirm(false);
    }
  }, [isAuth]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('languageChanged', handleLanguageChanged);

    return () => {
      window.removeEventListener('languageChanged', handleLanguageChanged);
    };
  }, []);
  

  const handleLogout = () => {
    const currentUser = JSON.parse(localStorage.getItem('user'));

      if (currentUser?.id) {
        socket.emit('logoutUser', String(currentUser.id));
        socket.disconnect();
      }
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');

    setUnreadMessagesCount(0);
    setFriendRequestsCount(0);
    setNotificationsCount(0);
    setPopupMessage(null);
    setShowLogoutConfirm(false);
    setPhotosUserId(null);
    setActivePost(null);
    setIsAuth(false);
    setSelectedConversationId(null);
    setSelectedUserId(null);
  };

  useEffect(() => {
    const handleAuthExpired = () => {
      handleLogout();
    };

    window.addEventListener('authExpired', handleAuthExpired);

    return () => {
      window.removeEventListener('authExpired', handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (!isAuth) return;

    let cancelled = false;

    api.get('/auth/me').catch((error) => {
      const status = error.response?.status;

      if (!cancelled && (status === 401 || status === 403)) {
        window.dispatchEvent(new Event('authExpired'));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuth]);

  const openPhotos = (userId) => {
    setActivePost(null);
    setPhotosUserId(userId);
    setPage('photos');
  };

  const openUserProfile = (username) => {
  const currentUser = JSON.parse(localStorage.getItem('user'));

  setActivePost(null);

  if (currentUser?.username === username) {
    setPage('profile');
    return;
  }

  setViewUsername(username);
  setPage('userProfile');
};

  if (isResetPasswordPage) {
    return <ResetPassword />;
  }
if (isVerifyEmailPage) {
  return <VerifyEmail />;
}
  if (!isAuth) {
    return (
      <Auth
        onLoginSuccess={() => {
          setIsAuth(true);
          setPage('feed');
          setActivePost(null);
        }}
      />
    );
  }

  return (
    
    <div className={`desktop-layout ${page === 'chat' ? 'chat-mode' : ''}`}>
      <aside className="left-sidebar">
        <h1 className="logo">Freedom</h1>

        {page === 'chat' && (
          <button
            className="chat-back-sidebar-btn"
            onClick={() => setPage('feed')}
          >
            <IoArrowBack />
          </button>
        )}

        <button
          className={page === 'feed' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setActivePost(null);
            setPage('feed');
          }}
        >
          {page === 'feed' ? <IoHome /> : <IoHomeOutline />}
          <span>{t('home', language)}</span>
        </button>

        <button
          className={page === 'friends' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setFriendsUsername(null);
            setFriendRequestsCount(0);
            setActivePost(null);
            setPage('friends');
          }}
        >
          {page === 'friends' ? <IoPeople /> : <IoPeopleOutline />}
          <span>{t('friends', language)}</span>
          {friendRequestsCount > 0 && (
            <span className="nav-badge">{friendRequestsCount}</span>
          )}
        </button>

        <button
          className={page === 'chat' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setActivePost(null);
            setPage('chat');
          }}
        >
          {page === 'chat' ? <IoChatbubbleEllipses /> : <IoChatbubbleEllipsesOutline />}
          <span>{t('chats', language)}</span>
          {unreadMessagesCount > 0 && (
            <span className="nav-badge">{unreadMessagesCount}</span>
          )}
        </button>

        <button
          className={page === 'notifications' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setActivePost(null);
            setNotificationsCount(0);
            setPage('notifications');
          }}
        >
          {page === 'notifications' ? <IoNotifications /> : <IoNotificationsOutline />}
          <span>{t('actions', language)}</span>
          {notificationsCount > 0 && (
            <span className="nav-badge">{notificationsCount}</span>
          )}
        </button>

        <button
          className={
            page === 'favorites'
              ? 'sidebar-link favorites-mobile-hidden active'
              : 'sidebar-link favorites-mobile-hidden'
          }
          onClick={() => {
            setActivePost(null);
            setPage('favorites');
          }}
        >
          {page === 'favorites' ? <IoHeart /> : <IoHeartOutline />}
          <span>{t('favorites', language)}</span>
        </button>

        <button
          className={page === 'profile' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setActivePost(null);
            setPage('profile');
          }}
        >
          {page === 'profile' ? <IoPerson /> : <IoPersonOutline />}
          <span>{t('profile', language)}</span>
        </button>

        <button
          className="sidebar-link logout-btn"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <IoLogOutOutline />
          <span>{t('logout', language)}</span>
        </button>
      </aside>
          
      <main className="main-content">
        {activePost && (
          <PostDetails
            post={activePost}
            language={language}
            onBack={() => setActivePost(null)}
            onUserClick={(username) => {
              setActivePost(null);
              setViewUsername(username);
              setPage('userProfile');
            }}
            onPostChanged={() => {}}
          />
        )}

        {!activePost && page === 'feed' && (
          <Feed
            language={language}
            onOpenUser={(username) => {
              setViewUsername(username);
              setPage('userProfile');
            }}
            onPostClick={setActivePost}
          />
        )}

        {!activePost && page === 'friends' && (
        <Friends
          language={language}
          username={friendsUsername}
          onOpenChat={(userId) => {
            setSelectedUserId(userId);
            setPage('chat');
          }}
          onOpenUser={(username) => {
            setViewUsername(username);
            setPage('userProfile');
          }}
          onRequestsSeen={() => setFriendRequestsCount(0)}
          requestSignal={friendRequestSignal}
        />
        )}

        {!activePost && page === 'notifications' && (
          <Notifications
            language={language}
            onOpenUser={(username) => {
              setViewUsername(username);
              setPage('userProfile');
            }}
              onOpenPost={async (postId) => {
                const post = await getPostByIdApi(postId);
                setActivePost(post);
              }}
              onOpenPhoto={async (photoId) => {
                const photo = await getPhotoByIdApi(photoId);
                setPopupPhoto(photo);
              }}
                onOpenGroupChat={(conversationId) => {
                setActivePost(null);
                setSelectedUserId(null);
                setSelectedConversationId(conversationId);
                setPage('chat');
              }}
          />
        )}
        
        {!activePost && page === 'favorites' && (
          <Favorites
            language={language}
            onOpenUser={(username) => {
              setViewUsername(username);
              setPage('userProfile');
            }}
            onPostClick={setActivePost}
          />
        )}

        {!activePost && page === 'photos' && (
          <Photos userId={photosUserId} />
        )}

        {!activePost && page === 'userProfile' && (
          <UserProfile
            language={language}
            username={viewUsername}
            onMessage={(userId) => {
              setSelectedUserId(userId);
              setPage('chat');
            }}
            onOpenFriends={(username) => {
              setFriendsUsername(username);
              setActivePost(null);
              setPage('friends');
            }}
            onOpenUser={openUserProfile}
            onOpenPhotos={openPhotos}
            onPostClick={setActivePost}
          />
        )}

        {!activePost && page === 'profile' && (
          <Profile
            onOpenFriends={() => {
              setFriendsUsername(null);
              setActivePost(null);
              setPage('friends');
            }}
            onOpenUser={(username) => {
              setViewUsername(username);
              setPage('userProfile');
            }}
            onOpenPhotos={openPhotos}
            onPostClick={setActivePost}
          />
        )}

        {!activePost && page === 'chat' && (
      <Chat
        language={language}
        onUnreadCountChange={setUnreadMessagesCount}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        selectedConversationId={selectedConversationId}
        setSelectedConversationId={setSelectedConversationId}
        audioCall={audioCall}
        onOpenUser={(username) => {
          setViewUsername(username);
          setPage('userProfile');
        }}
          onBackToHome={() => {
          setActivePost(null);
          setSelectedUserId(null);
          setSelectedConversationId(null);
          setPage('feed');
        }}
      />
        )}
      </main>

      {page !== 'chat' && (
        <aside className="right-sidebar">
          {page !== 'friends' && (
            <UserSearch
              language={language}
              onOpenUser={(username) => {
                setActivePost(null);
                setViewUsername(username);
                setPage('userProfile');
              }}
            />
          )}

          <WhoToFollow
            language={language}
            onOpenUser={(username) => {
              setActivePost(null);
              setViewUsername(username);
              setPage('userProfile');
            }}
          />

          <PopularPosts
            language={language}
            onOpenUser={(username) => {
              setActivePost(null);
              setViewUsername(username);
              setPage('userProfile');
            }}
          />
        </aside>
      )}

      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="logout-popup">
            <h3>{t('are_you_sure', language)}</h3>
            {t('logout_question', language) && <p>{t('logout_question', language)}</p>}

            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                {t('cancel', language)}
              </button>

              <button className="primary-btn" onClick={handleLogout}>
                {t('logout', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {popupMessage && (
      <NotificationPopup
        target={
          popupMessage.isGroup
            ? {
                display_name: popupMessage.group_name,
                avatar: popupMessage.group_avatar,
                subtitle: popupMessage.sender_name,
              }
            : {
                display_name: popupMessage.display_name,
                avatar: popupMessage.avatar,
                subtitle: `@${popupMessage.username}`,
              }
        }
        text={popupMessage.text}
        onClose={() => setPopupMessage(null)}
        onClick={() => {
          setActivePost(null);
          setPage('chat');

          if (popupMessage.isGroup) {
            setSelectedConversationId(popupMessage.conversationId);
          } else {
            setSelectedUserId(popupMessage.sender_id);
          }

          setPopupMessage(null);
        }}
      />
      )}

      {likePopup && (
        <NotificationPopup
          target={{
            display_name: likePopup.likedBy.display_name,
            avatar: likePopup.likedBy.avatar,
            subtitle: `@${likePopup.likedBy.username}`,
          }}
          text={`${t(likePopup.type === 'post' ? 'liked_your_post' : 'liked_your_photo', language)}`}
          onClose={() => setLikePopup(null)}
          onClick={() => {
            setLikePopup(null);

            if (likePopup.type === 'post') {
              setActivePost(likePopup.post);
            } else {
              setPopupPhoto(likePopup.photo);
            }
          }}
        />
      )}

      {commentPopup && (
        <NotificationPopup
          target={{
            display_name: commentPopup.commentedBy.display_name,
            avatar: commentPopup.commentedBy.avatar,
            subtitle: `@${commentPopup.commentedBy.username}`,
          }}
          text={`${t(commentPopup.type === 'post' ? 'commented_on_post' : 'commented_on_photo', language)}: ${commentPopup.comment.text}`}
          onClose={() => setCommentPopup(null)}
          onClick={() => {
            setCommentPopup(null);

            if (commentPopup.type === 'post') {
              setActivePost(commentPopup.post);
            } else {
              setPopupPhoto(commentPopup.photo);
            }
          }}
        />
      )}
      {friendAcceptedPopup && (
          <NotificationPopup
            target={{
              display_name: friendAcceptedPopup.display_name,
              avatar: friendAcceptedPopup.avatar,
              subtitle: `@${friendAcceptedPopup.username}`,
            }}
            text={t('accepted_friend_request', language)}
            onClose={() => setFriendAcceptedPopup(null)}
            onClick={() => {
              setFriendAcceptedPopup(null);
              setViewUsername(friendAcceptedPopup.username);
              setPage('userProfile');
            }}
          />
        )}

      {friendPopup && (
        <NotificationPopup
          target={{
            display_name: friendPopup.display_name,
            avatar: friendPopup.avatar,
            subtitle: `@${friendPopup.username}`,
          }}
          text={t('sent_friend_request', language)}
          onClose={() => setFriendPopup(null)}
          onClick={() => {
            setFriendPopup(null);
            setViewUsername(friendPopup.username);
            setPage('userProfile');
          }}
        />
      )}

      {popupPhoto && (
        <PhotoModal
          photo={popupPhoto}
          onClose={() => setPopupPhoto(null)}
          onPhotoChanged={() => {}}
        />
      )}

      {incomingCall && (
  <div className="call-popup">
    <h3>
      {incomingCall.withVideo ? t('incoming_video_call', language) : t('incoming_audio_call', language)}
    </h3>

<div className="call-popup-user">
  {incomingCall.caller?.avatar ? (
    <img
      src={getFileUrl(incomingCall.caller.avatar)}
      alt={incomingCall.caller.username}
      className="call-popup-avatar"
    />
  ) : (
    <div className="call-popup-avatar-placeholder">
      {(incomingCall.caller?.username || '?')
        .charAt(0)
        .toUpperCase()}
    </div>
  )}

  <p>
    {incomingCall.caller?.username || `User ${incomingCall.from}`} {t('is_calling_you', language)}
  </p>
</div>

    <div className="call-popup-actions">
    <button
      className="accept-call-btn"
      onClick={handleAcceptCall}
    >
      {t('accept', language)}
    </button>

      <button
        className="reject-call-btn"
        onClick={rejectCall}
      >
        {t('reject', language)}
      </button>
    </div>
  </div>
)}

<audio
  ref={remoteAudioRef}
  autoPlay
/>
<audio
  ref={ringtoneRef}
  src="/sounds/incoming_call.mp3"
/>
    </div>
  );
}

export default App;
