const Notification = require('../models/notification.model');

async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;

    const notifications = await Notification.getNotifications(
      userId,
      limit,
      offset
    );

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);

    res.status(500).json({
      message: 'Error getting notifications',
      error: error.message,
    });
  }
}

async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;

    await Notification.markAllAsRead(userId);

    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Mark notifications read error:', error);

    res.status(500).json({
      message: 'Error marking notifications as read',
      error: error.message,
    });
  }
}

async function deleteNotification(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await Notification.deleteNotification(id, userId);

    if (!deleted) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);

    res.status(500).json({
      message: 'Error deleting notification',
      error: error.message,
    });
  }
}

module.exports = {
  getNotifications,
  markAllAsRead,
  deleteNotification,
};