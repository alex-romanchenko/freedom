import { useRef, useState } from 'react';
import {
  FiFile,
  FiImage,
  FiMusic,
  FiPaperclip,
  FiSmile,
  FiSend,
} from 'react-icons/fi';
import { IoMic, IoStop, IoTrash, IoSend } from 'react-icons/io5';
import EmojiPicker from 'emoji-picker-react';


function ChatInput({
  replyTo,
  setReplyTo,
  editingMessage,
  setEditingMessage,
  setText,
  text,
  chatFile,
  setChatFile,
  chatImageInputRef,
  textareaRef,
  handleTextChange,
  handlePasteImage,
  showChatEmoji,
  setShowChatEmoji,
  chatEmojiRef,
  parseReplyMessage,
  saveEditedMessage,
  sendMessage,
  sendAudioMessage,
}) {
  const emojiTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordStartRef = useRef(null);
  const musicInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const blurChatInput = () => {
    textareaRef.current?.blur();

    if (
      document.activeElement instanceof HTMLElement &&
      typeof document.activeElement.blur === 'function'
    ) {
      document.activeElement.blur();
    }
  };

  const openFilePicker = (inputRef) => {
    blurChatInput();
    setShowChatEmoji(false);
    inputRef.current?.click();
    setShowAttachMenu(false);
  };

  const openEmojiWithDelay = () => {
    clearTimeout(emojiTimerRef.current);

    emojiTimerRef.current = setTimeout(() => {
      setShowChatEmoji(true);
    }, 180);
  };

  const closeEmojiWithDelay = () => {
    clearTimeout(emojiTimerRef.current);

    emojiTimerRef.current = setTimeout(() => {
      setShowChatEmoji(false);
    }, 220);
  };

  const keepEmojiOpen = () => {
    clearTimeout(emojiTimerRef.current);
    setShowChatEmoji(true);
  };

  const startRecording = async () => {
  try {
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });


    audioChunksRef.current = [];
    recordStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
    const blob = new Blob(audioChunksRef.current, {
      type: recorder.mimeType,
    });

blob.fileExtension = recorder.mimeType.includes('mp4') ? 'm4a' : 'webm';

      const duration = Math.max(
        1,
        Math.round((Date.now() - recordStartRef.current) / 1000)
      );

      setRecordedAudio(blob);
      setRecordDuration(duration);

      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  } catch (error) {
    console.error('Microphone error:', error);
    alert('Не вдалося отримати доступ до мікрофона');
  }
};

const stopRecording = () => {
  if (!mediaRecorderRef.current) return;

  mediaRecorderRef.current.stop();
  setIsRecording(false);
};

const cancelRecordedAudio = () => {
  setRecordedAudio(null);
  setRecordDuration(0);
};

const handleSendAudio = async () => {
  if (!recordedAudio) return;

  await sendAudioMessage(recordedAudio, recordDuration);

  setRecordedAudio(null);
  setRecordDuration(0);
};

  return (
    <>
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

      {chatFile && (
        <div className="chat-image-preview">
          {chatFile.type.startsWith('video/') ? (
            <video src={URL.createObjectURL(chatFile)} controls />
          ) : chatFile.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(chatFile)} alt="" />
          ) : (
            <div className="chat-file-preview">
              {chatFile.type.startsWith('audio/') ? <FiMusic /> : <FiFile />}
              <span>{chatFile.name}</span>
            </div>
          )}

          <button onClick={() => setChatFile(null)}>×</button>
        </div>
      )}

      {isRecording && (
        <div className="voice-preview recording-preview">
          <span className="record-dot"></span>
          <span>Запис голосового...</span>

          <button type="button" onClick={stopRecording}>
            <IoStop />
          </button>
        </div>
      )}

{recordedAudio && !isRecording && (
  <div className="voice-preview">
    <audio
      className="voice-preview-audio"
      src={URL.createObjectURL(recordedAudio)}
      controls
    />

    <button
      type="button"
      className="voice-delete-btn"
      onClick={cancelRecordedAudio}
    >
      <IoTrash />
    </button>

    <button
      type="button"
      className="voice-send-btn"
      onClick={handleSendAudio}
    >
      <IoSend />
    </button>
  </div>
)}

      <div className="chat-input-zone">
        <div className="chat-input-row">
          <div className={`chat-input-box ${showAttachMenu ? 'attach-open' : ''}`}>
            <button
              type="button"
              className="chat-icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                blurChatInput();
                setShowChatEmoji(false);
                setShowAttachMenu((value) => !value);
              }}
            >
              <FiPaperclip />
            </button>

            {showAttachMenu && (
              <div className="chat-attach-menu">
                <button
                  type="button"
                  onClick={() => {
                    openFilePicker(chatImageInputRef);
                  }}
                >
                  <FiImage />
                  <span>Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openFilePicker(musicInputRef);
                  }}
                >
                  <FiMusic />
                  <span>Music</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openFilePicker(fileInputRef);
                  }}
                >
                  <FiFile />
                  <span>File</span>
                </button>
              </div>
            )}

            <input
              ref={chatImageInputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setChatFile(file);
                e.target.value = '';
              }}
            />

            <input
              ref={musicInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setChatFile(file);
                e.target.value = '';
              }}
            />

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setChatFile(file);
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

            <div
              className="chat-emoji-hover-area"
              onMouseEnter={openEmojiWithDelay}
              onMouseLeave={closeEmojiWithDelay}
            >
              <button
                type="button"
                className="chat-icon-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  blurChatInput();
                  setShowAttachMenu(false);
                  setShowChatEmoji((value) => !value);
                }}
              >
                <FiSmile />
              </button>
            </div>
          </div>

          {text.trim() || chatFile || editingMessage ? (
            <button
              type="button"
              className="chat-send-btn"
              disabled={!text.trim() && !chatFile}
              onClick={editingMessage ? saveEditedMessage : sendMessage}
            >
              <FiSend />
            </button>
          ) : isRecording ? (
            <button
              type="button"
              className="chat-send-btn recording"
              onClick={stopRecording}
            >
              <IoStop />
            </button>
          ) : (
            <button
              type="button"
              className="chat-send-btn"
              onClick={startRecording}
            >
              <IoMic />
            </button>
          )}
        </div>

        {showChatEmoji && (
          <div
            className="chat-emoji-picker"
            ref={chatEmojiRef}
            onMouseEnter={keepEmojiOpen}
            onMouseLeave={closeEmojiWithDelay}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                setText((prev) => prev + emojiData.emoji);
              }}
              height={350}
              width="100%"
              previewConfig={{
                showPreview: false,
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default ChatInput;
