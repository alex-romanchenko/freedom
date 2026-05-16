const { 
  getUserById, 
  updateUserProfile, 
  findUserByUsername,
  searchUsers,
  updateUserAvatar,
  updateUserHeaderImage,
  getUsersForFollow,
} = require('../models/user.model');
const { getPostsByUser } = require('../models/post.model');
const { isFollowingUser } = require('../models/follow.model');

async function getMyProfile(req, res) {
  try {
    const userId = req.user.id;

    const user = await getUserById(userId);

    res.json(user);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting profile',
      error: error.message,
    });
  }
}

async function updateMyProfile(req, res) {
  try {
    const userId = req.user.id;

    const {
      username,
      displayName,
      firstName,
      lastName,
      birthDate,
      city,
      country,
      gender,
    } = req.body;

    const updatedUser = await updateUserProfile(userId, {
      username,
      displayName,
      firstName,
      lastName,
      birthDate,
      city,
      country,
      gender,
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating profile',
      error: error.message,
    });
  }
}

async function getUserProfile(req, res) {
  try {
    const { username } = req.params;

    const user = await findUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }
    const isFollowing = await isFollowingUser(req.user.id, user.id);
    const posts = await getPostsByUser(username, req.user.id);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName || user.display_name,
        avatar: user.avatar,
        headerImage: user.headerImage || user.header_image,

        firstName: user.firstName || user.first_name,
        lastName: user.lastName || user.last_name,
        birthDate: user.birthDate || user.birth_date,
        city: user.city,
        country: user.country,
        gender: user.gender,

        isFollowing,
      },
      posts,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error getting user profile',
      error: error.message,
    });
  }
}

async function searchUsersController(req, res) {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        message: 'Search query is required',
      });
    }

    const users = await searchUsers(q, req.user.id);

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: 'Error searching users',
      error: error.message,
    });
  }
}

async function updateMyAvatar(req, res) {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        message: 'Avatar file is required',
      });
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    const updatedUser = await updateUserAvatar(userId, avatarPath);

    res.json({
      message: 'Avatar updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating avatar',
      error: error.message,
    });
  }
}

async function updateMyHeaderImage(req, res) {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        message: 'Header image file is required',
      });
    }

    const headerPath = `/uploads/headers/${req.file.filename}`;

    const updatedUser = await updateUserHeaderImage(userId, headerPath);

    res.json({
      message: 'Header image updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating header image',
      error: error.message,
    });
  }
}

async function getWhoToFollow(req, res) {
  try {
    const userId = req.user.id;

    const users = await getUsersForFollow(userId);

    res.json(users);
  } catch (err) {
    res.status(500).json({
      message: 'Error getting users',
      error: err.message,
    });
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  getUserProfile,
  searchUsersController,
  updateMyAvatar,
  updateMyHeaderImage,
  getWhoToFollow,
};