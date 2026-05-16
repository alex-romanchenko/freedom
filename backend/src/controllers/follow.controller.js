const {
  followUser,
  unfollowUser,
  getMyFriends,
  getUserFriendsByUsername,
  getIncomingRequests,
  markIncomingRequestsSeen,
  isFollowingUser,
} = require('../models/follow.model');

const { createNotification } = require('../models/notification.model');
const db = require('../db');

async function follow(req, res) {
  try {
    const followerId = req.user.id;
    const { userId } = req.params;

    if (Number(followerId) === Number(userId)) {
      return res.status(400).json({
        message: 'You cannot follow yourself',
      });
    }

    const alreadyFollowing = await isFollowingUser(followerId, userId);

    await followUser(followerId, userId);

    if (!alreadyFollowing) {
      const senderResult = await db.query(
        `
        SELECT id, username, display_name, avatar
        FROM users
        WHERE id = $1
        `,
        [followerId]
      );

      const sender = {
        ...senderResult.rows[0],
        seen_by_following: false,
      };

      // 👉 запис в notifications
      await createNotification({
        userId: Number(userId),
        senderId: followerId,
        type: 'friend_request',
      });

      const io = req.app.get('io');

      io.emit('newFriendRequest', {
        ownerId: Number(userId),
        sender,
      });
    }

    res.json({ message: 'User followed' });
  } catch (error) {
    res.status(500).json({
      message: 'Error following user',
      error: error.message,
    });
  }
}

async function getUserFriends(req, res) {
  try {
    const { username } = req.params;

    const friends = await getUserFriendsByUsername(username);

    res.json(friends);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting user friends',
      error: error.message,
    });
  }
}

async function getFriends(req, res) {
  try {
    const friends = await getMyFriends(req.user.id);
    res.json(friends);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting friends',
      error: error.message,
    });
  }
}

async function unfollow(req, res) {
  try {
    const followerId = req.user.id;
    const { userId } = req.params;

    await unfollowUser(followerId, userId);

    res.json({ message: 'User unfollowed' });
  } catch (error) {
    res.status(500).json({
      message: 'Error unfollowing user',
      error: error.message,
    });
  }
}

async function getIncoming(req, res) {
  try {
    const requests = await getIncomingRequests(req.user.id);
    res.json(requests);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting incoming requests',
      error: error.message,
    });
  }
}

async function markRequestsSeen(req, res) {
  try {
    await markIncomingRequestsSeen(req.user.id);

    res.json({ message: 'Requests marked as seen' });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating requests',
      error: error.message,
    });
  }
}

module.exports = {
  follow,
  unfollow,
  getFriends,
  getUserFriends,
  getIncoming,
  markRequestsSeen,
};