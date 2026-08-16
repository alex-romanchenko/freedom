import {
  IoCallOutline,
  IoVideocamOutline,
  IoArrowBack,
  IoMic,
  IoMicOff,
  IoCameraReverseOutline,
  
  
} from 'react-icons/io5';
import { getFileUrl } from '../../api/fileUrl';
import { getIdentityColors } from '../../utils/identityColors';
import { t } from '../../utils/i18n';

function ChatHeader({
  selectedConv,
  onOpenUser,
  onOpenGroupInfo,
  onOpenContactInfo,
  getChatStatus,
  groupTypingStatus,
  language,
  isInCall,
  isCalling,
  isVideoCall,
  endCall,
  startCall,
  callStatus,
  callDuration,
  isMuted,
  toggleMute,
  switchCamera,
  setSelectedConv,
}) {
  const isGroup = selectedConv?.type === 'group';
  const identity = getIdentityColors(
    selectedConv?.username || selectedConv?.display_name || selectedConv?.id
  );
  const status = isGroup
    ? groupTypingStatus || t('group_chat', language)
    : getChatStatus();
  return (
    <div className="chat-header">
      <button
        className="mobile-back-btn"
        onClick={() => setSelectedConv(null)}
      >
        <IoArrowBack />
      </button>

      <div
        onClick={() => {
          if (isGroup) onOpenGroupInfo?.();
          else onOpenContactInfo?.();
        }}
        style={{ cursor: 'pointer' }}
      >
        {selectedConv.avatar ? (
          <img
            className="chat-header-avatar"
            src={getFileUrl(selectedConv.avatar)}
            alt=""
          />
        ) : (
          <div
            className="chat-header-avatar-placeholder"
            style={{
              backgroundColor: identity.background,
              color: identity.foreground,
            }}
          >
            {selectedConv.display_name?.[0] || '?'}
          </div>
        )}
      </div>

      <div className="chat-header-info">
        <div
          className="chat-header-name"
          onClick={() => {
            if (isGroup) onOpenGroupInfo?.();
            else onOpenContactInfo?.();
          }}
          style={{ cursor: 'pointer' }}
        >
          {selectedConv.display_name}
        </div>

        <span
          className={`chat-header-status ${
            !isGroup && status === 'online' ? 'online' : ''
          } ${isGroup && groupTypingStatus ? 'typing' : ''}`}
        >
          {status}
        </span>
      </div>

        {!isGroup && (
  <>
    {isInCall || isCalling ? (
      <button
        className="video-control-btn end-call-btn"
        onClick={endCall}
      >
        <IoCallOutline />
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
  </>
)}

      {!isGroup && callStatus && (
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

      {!isGroup && isInCall && !isVideoCall && (
        <button
          className={`mute-btn ${isMuted ? 'muted' : ''}`}
          onClick={toggleMute}
        >
          {isMuted ? <IoMicOff /> : <IoMic />}
        </button>
      )}
  
    </div>
  );
}

export default ChatHeader;
