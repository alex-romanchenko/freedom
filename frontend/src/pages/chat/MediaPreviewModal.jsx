import { createPortal } from 'react-dom';

function MediaPreviewModal({
  openedImage,
  setOpenedImage,
  openedVideo,
  setOpenedVideo,
}) {
  if (!openedImage && !openedVideo) return null;

  return createPortal(
    <>
      {openedImage && (
        <div
          className="image-preview-overlay"
          onClick={() => setOpenedImage(null)}
        >
          <img src={openedImage} alt="" />
        </div>
      )}

      {openedVideo && (
        <div
          className="image-preview-overlay"
          onClick={() => setOpenedVideo(null)}
        >
          <video
            src={openedVideo}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>,
    document.body
  );
}

export default MediaPreviewModal;