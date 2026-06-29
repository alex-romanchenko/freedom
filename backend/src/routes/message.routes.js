const express = require('express');
const uploadMessageAudio = require('../middleware/uploadMessageAudio');
const authMiddleware = require('../middleware/auth.middleware');
const uploadMessageFile = require('../middleware/uploadMessageFile');
const uploadMessageImage = require('../middleware/uploadMessageImage');
const { 
  sendMessage, 
  sendGroupMessage,
  getConversations, 
  getMessages,
  searchUserMessages,
  markAsRead,
  createConversation,
  deleteConversation,
  clearConversation,
  updateMessage,
  deleteMessage,
  forwardMessage,
} = require('../controllers/message.controller');

const router = express.Router();
router.post(
  '/audio/:userId',
  authMiddleware,
  uploadMessageAudio.single('audio'),
  sendMessage
);

router.post(
  '/group-audio/:conversationId',
  authMiddleware,
  uploadMessageAudio.single('audio'),
  sendGroupMessage
);
router.post(
  '/file/:userId',
  authMiddleware,
  uploadMessageFile.single('file'),
  sendMessage
);

router.post(
  '/group-file/:conversationId',
  authMiddleware,
  uploadMessageFile.single('file'),
  sendGroupMessage
);
router.get('/', authMiddleware, getConversations);
router.get('/search', authMiddleware, searchUserMessages);
router.post('/forward', authMiddleware, forwardMessage);
router.get('/:conversationId', authMiddleware, getMessages);
router.post('/conversations/:userId', authMiddleware, createConversation);
router.post('/:conversationId/read', authMiddleware, markAsRead);
router.post(
  '/group/:conversationId',
  authMiddleware,
  uploadMessageImage.single('image'),
  sendGroupMessage
);
router.post(
  '/:userId',
  authMiddleware,
  uploadMessageImage.single('image'),
  sendMessage
);
router.delete(
  '/conversations/:conversationId/clear',
  authMiddleware,
  clearConversation
);
router.delete('/conversations/:conversationId', authMiddleware, deleteConversation);
router.put('/message/:messageId', authMiddleware, updateMessage);
router.delete('/message/:messageId', authMiddleware, deleteMessage);

module.exports = router;
