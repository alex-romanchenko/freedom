import { useEffect, useState } from 'react';
import api from './api/api';
import socket from './socket';

import Feed from './pages/Feed';
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
} from 'react-icons/io5';

import { getIncomingRequestsApi } from './api/followApi';
import { getNotificationsApi } from './api/notificationsApi';

import './App.css';

function App() {
  const [isAuth, setIsAuth] = useState(() =>
    Boolean(localStorage.getItem('token') || sessionStorage.getItem('token'))
  );

  const [page, setPage] = useState('feed');
  const [friendRequestSignal, setFriendRequestSignal] = useState(0);
  const [friendPopup, setFriendPopup] = useState(null);
  const [commentPopup, setCommentPopup] = useState(null);
  const [likePopup, setLikePopup] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [popupMessage, setPopupMessage] = useState(null);
  const [popupPhoto, setPopupPhoto] = useState(null);
  const [viewUsername, setViewUsername] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [photosUserId, setPhotosUserId] = useState(null);

 const path = window.location.pathname;

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

    if (currentUser?.id) {
      socket.emit('joinUser', currentUser.id);
    }

    refreshUnreadCount();
    refreshFriendRequestsCount();
    refreshNotificationsCount();

    function handleNewMessage(data) {
      refreshUnreadCount();

      if (page !== 'chat') {
        playNotificationSound();
        setPopupMessage(data.message);

        setTimeout(() => {
          setPopupMessage(null);
        }, 10000);
      }
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
    socket.on('newFriendRequest', handleNewFriendRequest);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('newLike', handleNewLike);
      socket.off('newComment', handleNewComment);
      socket.off('newFriendRequest', handleNewFriendRequest);
      socket.off('newFriendRequest', handleNewFriendRequest);
    };
  }, [isAuth, page]);

  useEffect(() => {
    if (!isAuth) {
      setShowLogoutConfirm(false);
    }
  }, [isAuth]);

  const handleLogout = () => {
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
  };

  const openPhotos = (userId) => {
    setActivePost(null);
    setPhotosUserId(userId);
    setPage('photos');
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

        <button
          className={page === 'feed' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setActivePost(null);
            setPage('feed');
          }}
        >
          {page === 'feed' ? <IoHome /> : <IoHomeOutline />}
          <span>Home</span>
        </button>

        <button
          className={page === 'friends' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setFriendRequestsCount(0);
            setActivePost(null);
            setPage('friends');
          }}
        >
          {page === 'friends' ? <IoPeople /> : <IoPeopleOutline />}
          <span>Friends</span>
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
          <span>Messages</span>
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
          <span>Actions</span>
          {notificationsCount > 0 && (
            <span className="nav-badge">{notificationsCount}</span>
          )}
        </button>

        <button
          className={page === 'favorites' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setActivePost(null);
            setPage('favorites');
          }}
        >
          {page === 'favorites' ? <IoHeart /> : <IoHeartOutline />}
          <span>Favorites</span>
        </button>

        <button
          className={page === 'profile' ? 'sidebar-link active' : 'sidebar-link'}
          onClick={() => {
            setActivePost(null);
            setPage('profile');
          }}
        >
          {page === 'profile' ? <IoPerson /> : <IoPersonOutline />}
          <span>Profile</span>
        </button>

        <button
          className="sidebar-link logout-btn"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <IoLogOutOutline />
          <span>Logout</span>
        </button>
      </aside>
          
      <main className="main-content">
        {activePost && (
          <PostDetails
            post={activePost}
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
            onOpenUser={(username) => {
              setViewUsername(username);
              setPage('userProfile');
            }}
            onPostClick={setActivePost}
          />
        )}

        {!activePost && page === 'friends' && (
          <Friends
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
          />
        )}
        
        {!activePost && page === 'favorites' && (
          <Favorites
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
            username={viewUsername}
            onMessage={(userId) => {
              setSelectedUserId(userId);
              setPage('chat');
            }}
            onOpenUser={(username) => {
              setViewUsername(username);
              setPage('userProfile');
            }}
            onOpenPhotos={openPhotos}
            onPostClick={setActivePost}
          />
        )}

        {!activePost && page === 'profile' && (
          <Profile
            onOpenFriends={() => {
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
            onUnreadCountChange={setUnreadMessagesCount}
            selectedUserId={selectedUserId}
          />
        )}
      </main>

      {page !== 'chat' && (
        <aside className="right-sidebar">
          {page !== 'friends' && (
            <UserSearch
              onOpenUser={(username) => {
                setActivePost(null);
                setViewUsername(username);
                setPage('userProfile');
              }}
            />
          )}

          <WhoToFollow
            onOpenUser={(username) => {
              setActivePost(null);
              setViewUsername(username);
              setPage('userProfile');
            }}
          />

          <PopularPosts
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
            <h3>Are you sure?</h3>
            <p>Do you really want to logout?</p>

            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>

              <button className="primary-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {popupMessage && (
        <NotificationPopup
          user={popupMessage}
          text={popupMessage.text}
          onClose={() => setPopupMessage(null)}
          onClick={() => {
            setActivePost(null);
            setPage('chat');
            setSelectedUserId(popupMessage.sender_id);
            setPopupMessage(null);
          }}
        />
      )}

      {likePopup && (
        <NotificationPopup
          user={likePopup.likedBy}
          text={`liked your ${likePopup.type}`}
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
          user={commentPopup.commentedBy}
          text={`commented on your ${commentPopup.type}: ${commentPopup.comment.text}`}
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

      {friendPopup && (
        <NotificationPopup
          user={friendPopup}
          text="sent you a friend request"
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
    </div>
  );
}

export default App;