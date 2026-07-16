const { 
  getUserById, 
  updateUserProfile,
  updateUserLanguage,
  findUserByUsername,
  searchUsers,
  updateUserAvatar,
  updateUserHeaderImage,
  getUsersForFollow,
  saveFcmToken,
  deleteFcmToken,
} = require('../models/user.model');
const { getPostsByUser } = require('../models/post.model');
const { isFollowingUser } = require('../models/follow.model');
const Photo = require('../models/photo.model');

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

async function updateMyLanguage(req, res) {
  try {
    const { language } = req.body;
    if (!['en', 'uk', 'ru'].includes(language)) {
      return res.status(400).json({ message: 'Unsupported language' });
    }

    const user = await updateUserLanguage(req.user.id, language);
    res.json({ language: user.language });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating language',
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

        is_following: isFollowing,
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
    const avatarPhoto = await Photo.createPhoto(userId, avatarPath, '');

    res.json({
      message: 'Avatar updated successfully',
      user: updatedUser,
      photo: avatarPhoto,
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

async function saveFcmTokenController(req, res) {
  try {
    const userId = req.user.id;
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({
        message: 'FCM token is required',
      });
    }

    const savedToken = await saveFcmToken(
      userId,
      token,
      platform || 'android'
    );

    res.json({
      message: 'FCM token saved',
      token: savedToken,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error saving FCM token',
      error: error.message,
    });
  }
}

async function deleteFcmTokenController(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        message: 'FCM token is required',
      });
    }

    await deleteFcmToken(token);

    res.json({
      message: 'FCM token deleted',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting FCM token',
      error: error.message,
    });
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  updateMyLanguage,
  getUserProfile,
  searchUsersController,
  updateMyAvatar,
  updateMyHeaderImage,
  getWhoToFollow,
  saveFcmTokenController,
  deleteFcmTokenController,
};
