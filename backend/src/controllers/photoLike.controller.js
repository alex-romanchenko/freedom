const PhotoLike = require('../models/photoLike.model');
const { createNotification } = require('../models/notification.model');
const db = require('../db');

function getValidId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

async function like(req, res) {
  try {
    const userId = req.user.id;
    const photoId = getValidId(req.params.id);

      if (!photoId) {
        return res.status(400).json({ message: 'Invalid photo id' });
      }

    await PhotoLike.likePhoto(userId, photoId);

    try {
      const photoResult = await db.query(
        `
        SELECT 
          p.id,
          p.user_id,
          p.image,
          p.description,
          p.created_at,
          u.username,
          u.display_name,
          u.avatar,
          COUNT(DISTINCT pl.id) AS likes_count,
          COUNT(DISTINCT pc.id) AS comments_count,
          true AS is_liked
        FROM photos p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN photo_likes pl ON pl.photo_id = p.id
        LEFT JOIN photo_comments pc ON pc.photo_id = p.id
        WHERE p.id = $1
        GROUP BY p.id, u.id
        `,
        [photoId]
      );

      const photo = photoResult.rows[0];

      if (photo && Number(photo.user_id) !== Number(userId)) {
        await createNotification({
          userId: photo.user_id,
          senderId: userId,
          type: 'like_photo',
          entityId: photo.id,
          entityType: 'photo',
        });
      }

      const userResult = await db.query(
        `SELECT id, username, display_name, avatar FROM users WHERE id = $1`,
        [userId]
      );

      const likedBy = userResult.rows[0];
      const io = req.app.get('io');

      if (photo && Number(photo.user_id) !== Number(userId)) {
        io.emit('newLike', {
          type: 'photo',
          photoId: photo.id,
          photo,
          ownerId: photo.user_id,
          likedBy,
        });
      }
    } catch (notifyError) {
      console.error('Photo like notification error:', notifyError);
    }

    res.json({ message: 'Liked' });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function unlike(req, res) {
  try {
    const userId = req.user.id;
    const photoId = getValidId(req.params.id);

        if (!photoId) {
          return res.status(400).json({ message: 'Invalid photo id' });
        }

    await PhotoLike.unlikePhoto(userId, photoId);

    res.json({ message: 'Unliked' });
  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getLikes(req, res) {
  try {
    const photoId = getValidId(req.params.id);

      if (!photoId) {
        return res.status(400).json({ message: 'Invalid photo id' });
      }

    const users = await PhotoLike.getPhotoLikes(photoId);

    res.json(users);
  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  like,
  unlike,
  getLikes,
};