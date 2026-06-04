import {
  IoCallOutline,
  IoVideocamOutline,
  IoArrowBack,
  IoMic,
  IoMicOff,
  IoCameraReverseOutline,
  
  
} from 'react-icons/io5';
import { getFileUrl } from '../../api/fileUrl';

function ChatHeader({
  selectedConv,
  onOpenUser,
  onOpenGroupInfo,
  getChatStatus,
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
          else onOpenUser(selectedConv.username);
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
          <div className="chat-header-avatar-placeholder">
            {selectedConv.display_name?.[0] || '?'}
          </div>
        )}
      </div>

      <div className="chat-header-info">
        <div
          className="chat-header-name"
          onClick={() => {
            if (isGroup) onOpenGroupInfo?.();
            else onOpenUser(selectedConv.username);
          }}
          style={{ cursor: 'pointer' }}
        >
          {selectedConv.display_name}
        </div>

        <span
          className={`chat-header-status ${
            !isGroup && getChatStatus() === 'online' ? 'online' : ''
          }`}
        >
          {isGroup ? 'group chat' : getChatStatus()}
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