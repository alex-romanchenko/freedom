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
  destination: function (req, file, cb) {
    if (imageTypes.includes(file.mimetype)) {
      return cb(null, 'public/uploads/posts');
    }

    if (videoTypes.includes(file.mimetype)) {
      return cb(null, 'public/uploads/post-videos');
    }

    cb(new Error('Only image or video files are allowed'));
  },

  filename: function (req, file, cb) {
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

const uploadPostImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

module.exports = uploadPostImage;