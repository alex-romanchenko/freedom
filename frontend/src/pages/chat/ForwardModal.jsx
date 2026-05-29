import { getFileUrl } from '../../api/fileUrl';

function ForwardModal({
  forwardMessageData,
  conversations,
  selectedConv,
  sendForwardMessage,
  setForwardMessageData,
}) {
  if (!forwardMessageData) return null;

  return (
    <div className="modal-overlay">
      <div className="forward-popup">
        <h3>Forward message</h3>

        {conversations.filter((c) => c.id !== selectedConv?.id).length === 0 ? (
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
  );
}

export default ForwardModal;