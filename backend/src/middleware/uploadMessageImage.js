const multer = require('multer');
const path = require('path');

const imageTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

const videoTypes = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  const isImage = imageTypes.includes(file.mimetype);

  const isVideo =
    videoTypes.includes(file.mimetype) ||
    ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext);

  if (isVideo) {
    return cb(null, 'public/uploads/message-videos');
  }

  if (isImage) {
    return cb(null, 'public/uploads/messages');
  }

  cb(new Error('Only image or video files are allowed'));
},

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (
    imageTypes.includes(file.mimetype) ||
    videoTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only image or video files are allowed'), false);
  }
};

const uploadMessageImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

module.exports = uploadMessageImage;