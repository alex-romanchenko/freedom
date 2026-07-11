const PostComment = require('../models/postComment.model');
const { createNotification } = require('../models/notification.model');
const db = require('../db');

async function createComment(req, res) {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const { text, parentCommentId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const comment = await PostComment.createComment(
      userId,
      postId,
      text.trim(),
      parentCommentId
    );

    try {
      const postResult = await db.query(
        `
        SELECT 
          p.id,
          p.user_id,
          p.text,
          p.image,
          p.created_at,
          u.username,
          u.display_name,
          u.avatar
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = $1
        `,
        [postId]
      );

      const post = postResult.rows[0];

      const userResult = await db.query(
        `
        SELECT id, username, display_name, avatar
        FROM users
        WHERE id = $1
        `,
        [userId]
      );

      const commentedBy = userResult.rows[0];

      if (post && Number(post.user_id) !== Number(userId)) {
        await createNotification({
          userId: post.user_id,
          senderId: userId,
          type: 'comment_post',
          entityId: post.id,
          entityType: 'post',
          text: text.trim(),
        });

        const io = req.app.get('io');

        io.emit('newComment', {
          type: 'post',
          post,
          postId: post.id,
          ownerId: post.user_id,
          comment,
          commentedBy,
        });
      }
    } catch (notifyError) {
      console.error('Post comment notification error:', notifyError);
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create post comment error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
}

async function getComments(req, res) {
  try {
    const postId = req.params.postId;

    const comments = await PostComment.getComments(postId);

    res.json(comments);
  } catch (error) {
    console.error('Get post comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteComment(req, res) {
  try {
    const userId = req.user.id;
    const commentId = req.params.commentId;

    const deletedComment = await PostComment.deleteComment(commentId, userId);

    if (!deletedComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete post comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updateComment(req, res) {
  try {
    const userId = req.user.id;
    const commentId = req.params.commentId;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const updatedComment = await PostComment.updateComment(
      commentId,
      userId,
      text.trim()
    );

    if (!updatedComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.json(updatedComment);
  } catch (error) {
    console.error('Update post comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createComment,
  getComments,
  deleteComment,
  updateComment,
};
