import { getFileUrl } from '../api/fileUrl';
function NotificationPopup({ user, text, onClick, onClose }) {
  if (!user) return null;

  return (
    <div className="message-popup" onClick={onClick}>
      <div className="popup-header">
        <strong>Freedom</strong>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      </div>

      <div className="popup-user">
        {user.avatar ? (
          <img
            src={getFileUrl(user.avatar)}
            alt=""
          />
        ) : (
          <div className="popup-avatar">
            {user.display_name?.[0] || '?'}
          </div>
        )}

        <div>
          <strong>{user.display_name}</strong>
          <p>@{user.username}</p>
        </div>
      </div>

      <p className="popup-text">{text}</p>
    </div>
  );
}

export default NotificationPopup;