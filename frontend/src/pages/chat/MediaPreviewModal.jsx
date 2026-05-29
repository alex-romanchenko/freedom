function MediaPreviewModal({
  openedImage,
  setOpenedImage,
  openedVideo,
  setOpenedVideo,
}) {
  return (
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
    </>
  );
}

export default MediaPreviewModal;