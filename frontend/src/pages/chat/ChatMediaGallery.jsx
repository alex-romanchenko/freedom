import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronBack, IoChevronForward, IoClose } from 'react-icons/io5';
import { getFileUrl } from '../../api/fileUrl';

function ChatMediaGallery({ media, index, onClose, onChange }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onChange(Math.max(0, index - 1));
      if (event.key === 'ArrowRight') onChange(Math.min(media.length - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media.length, index, onChange, onClose]);

  if (!media.length) return null;
  const current = media[index];
  return createPortal(
    <div className="chat-media-gallery" onClick={onClose}>
      <button className="chat-media-gallery-close" onClick={onClose}><IoClose /></button>
      <span className="chat-media-gallery-counter">{index + 1} / {media.length}</span>
      {index > 0 && <button className="chat-media-gallery-prev" onClick={(event) => { event.stopPropagation(); onChange(index - 1); }}><IoChevronBack /></button>}
      {current.type === 'video'
        ? <video src={getFileUrl(current.path)} controls autoPlay playsInline onClick={(event) => event.stopPropagation()} />
        : <img src={getFileUrl(current.path)} alt="" onClick={(event) => event.stopPropagation()} />}
      {index < media.length - 1 && <button className="chat-media-gallery-next" onClick={(event) => { event.stopPropagation(); onChange(index + 1); }}><IoChevronForward /></button>}
    </div>,
    document.body
  );
}

export default ChatMediaGallery;
