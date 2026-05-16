const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const {
  getNotifications,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notification.controller');

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.put('/read', authMiddleware, markAllAsRead);
router.delete('/:id', authMiddleware, deleteNotification);

module.exports = router;