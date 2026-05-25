const { 
  createPost, 
  getAllPosts,
  likePost, 
  unlikePost,
  getLikedPosts,
  getFeedByFollowing,
  updatePostById, 
  deletePostById,
  getMyPosts,
  getPostLikes,
  getPostById,
  getPopularPosts,
  
} = require('../models/post.model');
const { createNotification } = require('../models/notification.model');
const { getFollowersIds } = require('../models/follow.model');
const db = require('../db');


async function createNewPost(req, res) {
  try {
    const userId = req.user.id;
    const { text } = req.body;

    if (!text && !req.file) {
      return res.status(400).json({
        message: 'Post text or image is required',
      });
    }

    if (text && text.length > 280) {
      return res.status(400).json({
        message: 'Post text must be 280 characters or less',
      });
    }

    let imagePath = null;

    if (req.file) {
      imagePath = `/uploads/posts/${req.file.filename}`;
    }

    const post = await createPost({
  userId,
  text,
  image: imagePath,
});

const fullPost = await getPostById(post.id);

try {
  const followersIds = await getFollowersIds(userId);

  for (const followerId of followersIds) {
    await createNotification({
      userId: followerId,
      senderId: userId,
      type: 'new_post',
      entityId: fullPost.id,
      entityType: 'post',
      text: fullPost.text,
    });
  }

  const io = req.app.get('io');

  followersIds.forEach((followerId) => {
    io.to(`user_${followerId}`).emit('newPost', {
      ownerId: followerId,
      post: fullPost,
    });
  });
} catch (notifyError) {
  console.error('New post notification error:', notifyError);
}

res.status(201).json({
  message: 'Post created successfully',
  post: fullPost,
});
  } catch (error) {
    res.status(500).json({
      message: 'Error creating post',
      error: error.message,
    });
  }
}

async function getFeed(req, res) {
  try {
    const userId = req.user.id;

    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;

    const posts = await getFeedByFollowing(userId, limit, offset);

    res.json(posts);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting feed',
      error: error.message,
    });
  }
}

async function like(req, res) {
  try {
    const userId = req.user.id;
    const { postId } = req.params;

    await likePost(userId, postId);

    try {
      const post = await getPostById(postId);

      if (post && Number(post.user_id) !== Number(userId)) {
        await createNotification({
          userId: post.user_id,
          senderId: userId,
          type: 'like_post',
          entityId: post.id,
          entityType: 'post',
        });
      }

      const userResult = await db.query(
        `SELECT id, username, display_name, avatar FROM users WHERE id = $1`,
        [userId]
      );

      const likedBy = userResult.rows[0];
      const io = req.app.get('io');

      if (post && Number(post.user_id) !== Number(userId)) {
        io.emit('newLike', {
          type: 'post',
          post,
          postId: post.id,
          ownerId: post.user_id,
          likedBy,
        });
      }
    } catch (notifyError) {
      console.error('Post like notification error:', notifyError);
    }

    res.json({ message: 'Post liked' });
  } catch (error) {
    res.status(500).json({
      message: 'Error liking post',
      error: error.message,
    });
  }
}

async function unlike(req, res) {
  try {
    const userId = req.user.id;
    const { postId } = req.params;

    await unlikePost(userId, postId);

    res.json({ message: 'Post unliked' });
  } catch (error) {
    res.status(500).json({
      message: 'Error unliking post',
      error: error.message,
    });
  }
}

async function getFavorites(req, res) {
  try {
    const userId = req.user.id;

    const posts = await getLikedPosts(userId);

    res.json(posts);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting favorites',
      error: error.message,
    });
  }
}

async function updatePost(req, res) {
  try {
    const userId = req.user.id;
    const { postId } = req.params;
    const { text } = req.body;

    const updatedPost = await updatePostById(postId, userId, text);

    res.json({
      message: 'Post updated successfully',
      post: updatedPost,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating post',
      error: error.message,
    });
  }
}

async function deletePost(req, res) {
  try {
    const userId = req.user.id;
    const { postId } = req.params;

    await deletePostById(postId, userId);

    res.json({
      message: 'Post deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting post',
      error: error.message,
    });
  }
}
async function getMyFeed(req, res) {
  try {
    const userId = req.user.id;

    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;

    const posts = await getMyPosts(userId, limit, offset);

    res.json(posts);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting my posts',
      error: error.message,
    });
  }
}


async function getPopular(req, res) {
  try {
    const posts = await getPopularPosts();
    res.json(posts);
  } catch (err) {
    res.status(500).json({
      message: 'Error getting popular posts',
      error: err.message,
    });
  }
}

async function getLikes(req, res) {
  try {
    const { postId } = req.params;

    const users = await getPostLikes(postId);

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting post likes',
      error: error.message,
    });
  }
}

async function getPost(req, res) {
  try {
    const { postId } = req.params;
    const post = await getPostById(postId, req.user.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting post',
      error: error.message,
    });
  }
}


module.exports = {
  createNewPost, 
  getFeed,
  like,
  unlike,
  getFavorites,
  updatePost,
  deletePost,
  getMyFeed,
  getPopular,
  getLikes,
  getPost,
};