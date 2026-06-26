const fs = require('fs');
const multer = require('multer');
const path = require('path');

const dir = path.join(__dirname, '../../public/uploads/message-files');

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const uploadMessageFile = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

module.exports = uploadMessageFile;
