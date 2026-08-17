import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronBack, IoChevronForward, IoClose } from 'react-icons/io5';
import { getFileUrl } from '../../api/fileUrl';

function ChatMediaGallery({ images, index, onClose, onChange }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onChange(Math.max(0, index - 1));
      if (event.key === 'ArrowRight') onChange(Math.min(images.length - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, index, onChange, onClose]);

  if (!images.length) return null;
  return createPortal(
    <div className="chat-media-gallery" onClick={onClose}>
      <button className="chat-media-gallery-close" onClick={onClose}><IoClose /></button>
      <span className="chat-media-gallery-counter">{index + 1} / {images.length}</span>
      {index > 0 && <button className="chat-media-gallery-prev" onClick={(event) => { event.stopPropagation(); onChange(index - 1); }}><IoChevronBack /></button>}
      <img src={getFileUrl(images[index])} alt="" onClick={(event) => event.stopPropagation()} />
      {index < images.length - 1 && <button className="chat-media-gallery-next" onClick={(event) => { event.stopPropagation(); onChange(index + 1); }}><IoChevronForward /></button>}
    </div>,
    document.body
  );
}

export default ChatMediaGallery;
