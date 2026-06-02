import { getFileUrl } from '../api/fileUrl';

function NotificationPopup({ target, text, onClick, onClose }) {
  if (!target) return null;

  const avatar = target.avatar;
  const title = target.display_name;
  const subtitle = target.subtitle;

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
        {avatar ? (
          <img src={getFileUrl(avatar)} alt="" />
        ) : (
          <div className="popup-avatar">
            {title?.[0] || '?'}
          </div>
        )}

        <div>
          <strong>{title}</strong>
          <p>{subtitle}</p>
        </div>
      </div>

      <p className="popup-text">{text}</p>
    </div>
  );
}

export default NotificationPopup;