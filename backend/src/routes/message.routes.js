const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const uploadMessageImage = require('../middleware/uploadMessageImage');
const { 
  sendMessage, 
  getConversations, 
  getMessages,
  markAsRead,
  createConversation,
  deleteConversation,
  updateMessage,
  deleteMessage,
} = require('../controllers/message.controller');

const router = express.Router();

router.get('/', authMiddleware, getConversations);
router.get('/:conversationId', authMiddleware, getMessages);
router.post('/conversations/:userId', authMiddleware, createConversation);
router.post('/:conversationId/read', authMiddleware, markAsRead);
router.post(
  '/:userId',
  authMiddleware,
  uploadMessageImage.single('image'),
  sendMessage
);
router.delete('/conversations/:conversationId', authMiddleware, deleteConversation);
router.put('/message/:messageId', authMiddleware, updateMessage);
router.delete('/message/:messageId', authMiddleware, deleteMessage);

module.exports = router;