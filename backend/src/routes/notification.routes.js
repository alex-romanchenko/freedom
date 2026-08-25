const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notification.controller');

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.get('/unread-count', authMiddleware, getUnreadCount);
router.put('/read', authMiddleware, markAllAsRead);
router.delete('/:id', authMiddleware, deleteNotification);

module.exports = router;
