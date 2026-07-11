const PhotoComment = require('../models/photoComment.model');
const { createNotification } = require('../models/notification.model');
const db = require('../db');

function getValidId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

async function createComment(req, res) {
  try {
    const userId = req.user.id;
    const photoId = getValidId(req.params.id);

      if (!photoId) {
        return res.status(400).json({ message: 'Invalid photo id' });
      }
    const { text, parentCommentId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const comment = await PhotoComment.createComment(
      userId,
      photoId,
      text.trim(),
      parentCommentId
    );

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
          false AS is_liked
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

      const userResult = await db.query(
        `
        SELECT id, username, display_name, avatar
        FROM users
        WHERE id = $1
        `,
        [userId]
      );

      const commentedBy = userResult.rows[0];

      if (photo && Number(photo.user_id) !== Number(userId)) {
        await createNotification({
          userId: photo.user_id,
          senderId: userId,
          type: 'comment_photo',
          entityId: photo.id,
          entityType: 'photo',
          text: text.trim(),
        });

        const io = req.app.get('io');

        io.emit('newComment', {
          type: 'photo',
          photo,
          photoId: photo.id,
          ownerId: photo.user_id,
          comment,
          commentedBy,
        });
      }
    } catch (notifyError) {
      console.error('Photo comment notification error:', notifyError);
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create photo comment error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
}

async function getComments(req, res) {
  try {
    const photoId = getValidId(req.params.id);

      if (!photoId) {
        return res.status(400).json({ message: 'Invalid photo id' });
      }

    const comments = await PhotoComment.getComments(photoId);

    res.json(comments);
  } catch (error) {
    console.error('Get photo comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteComment(req, res) {
  try {
    const userId = req.user.id;
    const commentId = getValidId(req.params.commentId);

      if (!commentId) {
        return res.status(400).json({ message: 'Invalid comment id' });
      }

    const deletedComment = await PhotoComment.deleteComment(commentId, userId);

    if (!deletedComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete photo comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updateComment(req, res) {
  try {
    const userId = req.user.id;
    const commentId = getValidId(req.params.commentId);

      if (!commentId) {
        return res.status(400).json({ message: 'Invalid comment id' });
      }
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const updatedComment = await PhotoComment.updateComment(
      commentId,
      userId,
      text.trim()
    );

    if (!updatedComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.json(updatedComment);
  } catch (error) {
    console.error('Update photo comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createComment,
  getComments,
  deleteComment,
  updateComment,
};
