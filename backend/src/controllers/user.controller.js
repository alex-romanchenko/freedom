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
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../db');

const uploadsDirectory = path.resolve(__dirname, '../../public/uploads');

async function removeUploadedAsset(assetPath) {
  if (!assetPath || !assetPath.startsWith('/uploads/')) return;

  const absolutePath = path.resolve(
    uploadsDirectory,
    assetPath.slice('/uploads/'.length)
  );

  if (
    absolutePath !== uploadsDirectory &&
    !absolutePath.startsWith(`${uploadsDirectory}${path.sep}`)
  ) {
    return;
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Delete account asset error:', error);
    }
  }
}

async function removePreviousAvatar(avatar) {
  if (!avatar || !avatar.startsWith('/uploads/avatars/')) return;

  const avatarDirectory = path.resolve(__dirname, '../../public/uploads/avatars');
  const avatarFile = path.join(avatarDirectory, path.basename(avatar));

  try {
    await fs.unlink(avatarFile);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Delete previous avatar error:', error);
    }
  }
}

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
    const previousUser = await getUserById(userId);

    const updatedUser = await updateUserAvatar(userId, avatarPath);
    const avatarPhoto = await Photo.upsertAvatarPhoto(userId, avatarPath);
    await removePreviousAvatar(previousUser?.avatar);

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

async function deleteMyAccount(req, res) {
  const userId = Number(req.user.id);
  const password = String(req.body?.password || '');

  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  const client = await pool.connect();
  let assets = [];

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id, password, avatar, header_image FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Account not found' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      await client.query('ROLLBACK');
      return res.status(401).json({ message: 'Invalid password' });
    }

    const assetResult = await client.query(
      `SELECT asset FROM (
         SELECT avatar AS asset FROM users WHERE id = $1
         UNION ALL SELECT header_image FROM users WHERE id = $1
         UNION ALL SELECT image FROM posts WHERE user_id = $1
         UNION ALL SELECT video FROM posts WHERE user_id = $1
         UNION ALL SELECT image FROM photos WHERE user_id = $1
         UNION ALL SELECT image FROM messages WHERE sender_id = $1
         UNION ALL SELECT video FROM messages WHERE sender_id = $1
         UNION ALL SELECT audio FROM messages WHERE sender_id = $1
         UNION ALL SELECT file FROM messages WHERE sender_id = $1
       ) account_assets
       WHERE asset IS NOT NULL AND asset <> ''`,
      [userId]
    );
    assets = [...new Set(assetResult.rows.map((row) => row.asset))];

    await client.query(
      `UPDATE conversations AS conversation
       SET admin_id = (
         SELECT member.user_id
         FROM conversation_members AS member
         WHERE member.conversation_id = conversation.id
           AND member.user_id <> $1
         ORDER BY member.joined_at, member.user_id
         LIMIT 1
       )
       WHERE conversation.is_group = true
         AND conversation.admin_id = $1
         AND EXISTS (
           SELECT 1
           FROM conversation_members AS member
           WHERE member.conversation_id = conversation.id
             AND member.user_id <> $1
         )`,
      [userId]
    );

    const conversationsResult = await client.query(
      `SELECT id
       FROM conversations
       WHERE (is_group = false AND (user_one_id = $1 OR user_two_id = $1))
          OR (
            is_group = true
            AND admin_id = $1
            AND NOT EXISTS (
              SELECT 1
              FROM conversation_members
              WHERE conversation_id = conversations.id
                AND user_id <> $1
            )
          )`,
      [userId]
    );
    const conversationIds = conversationsResult.rows.map((row) => row.id);

    await client.query(
      `DELETE FROM message_reactions
       WHERE user_id = $1
          OR message_id IN (
            SELECT id FROM messages
            WHERE sender_id = $1 OR conversation_id = ANY($2::int[])
          )`,
      [userId, conversationIds]
    );
    await client.query(
      'DELETE FROM conversation_reads WHERE user_id = $1 OR conversation_id = ANY($2::int[])',
      [userId, conversationIds]
    );
    await client.query(
      'DELETE FROM conversation_members WHERE user_id = $1 OR conversation_id = ANY($2::int[])',
      [userId, conversationIds]
    );
    await client.query(
      'DELETE FROM messages WHERE sender_id = $1 OR conversation_id = ANY($2::int[])',
      [userId, conversationIds]
    );
    await client.query(
      'DELETE FROM conversations WHERE id = ANY($1::int[])',
      [conversationIds]
    );

    await client.query(
      `DELETE FROM post_comments
       WHERE user_id = $1 OR post_id IN (SELECT id FROM posts WHERE user_id = $1)`,
      [userId]
    );
    await client.query(
      `DELETE FROM likes
       WHERE user_id = $1 OR post_id IN (SELECT id FROM posts WHERE user_id = $1)`,
      [userId]
    );
    await client.query(
      `DELETE FROM photo_comments
       WHERE user_id = $1 OR photo_id IN (SELECT id FROM photos WHERE user_id = $1)`,
      [userId]
    );
    await client.query(
      `DELETE FROM photo_likes
       WHERE user_id = $1 OR photo_id IN (SELECT id FROM photos WHERE user_id = $1)`,
      [userId]
    );
    await client.query(
      'DELETE FROM notifications WHERE user_id = $1 OR sender_id = $1',
      [userId]
    );
    await client.query(
      'DELETE FROM follows WHERE follower_id = $1 OR following_id = $1',
      [userId]
    );
    await client.query(
      'DELETE FROM pending_calls WHERE caller_id = $1 OR receiver_id = $1',
      [userId]
    );
    await client.query('DELETE FROM user_fcm_tokens WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM email_tokens WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM password_tokens WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM posts WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM photos WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    await Promise.allSettled(assets.map(removeUploadedAsset));
    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete account error:', error);
    return res.status(500).json({
      message: 'Error deleting account',
      error: error.message,
    });
  } finally {
    client.release();
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
  deleteMyAccount,
};
