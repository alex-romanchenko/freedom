const pool = require('../db');

async function createPost({ userId, text, image }) {
  const result = await pool.query(
    `INSERT INTO posts (user_id, text, image)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, text, image, created_at`,
    [userId, text, image || null]
  );

  return result.rows[0];
}

async function getAllPosts() {
  const result = await pool.query(`
    SELECT 
      posts.id,
      posts.text,
      posts.image,
      posts.created_at,
      users.username,
      users.display_name,
      users.avatar,
      COUNT(likes.id) AS likes_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    LEFT JOIN likes ON likes.post_id = posts.id
    GROUP BY posts.id, users.id
    ORDER BY posts.created_at DESC
  `);

  return result.rows;
}

async function likePost(userId, postId) {
  await pool.query(
    `INSERT INTO likes (user_id, post_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, postId]
  );
}

async function unlikePost(userId, postId) {
  await pool.query(
    `DELETE FROM likes
     WHERE user_id = $1 AND post_id = $2`,
    [userId, postId]
  );
}

async function getLikedPosts(userId) {
  const result = await pool.query(`
    SELECT 
      posts.id,
      posts.text,
      posts.image,
      posts.created_at,
      users.username,
      users.display_name,
      users.avatar,
      true AS is_liked,
      COUNT(all_likes.id)::int AS likes_count
    FROM likes
    JOIN posts ON likes.post_id = posts.id
    JOIN users ON posts.user_id = users.id
    LEFT JOIN likes AS all_likes ON all_likes.post_id = posts.id
    WHERE likes.user_id = $1
    GROUP BY posts.id, users.id
    ORDER BY posts.created_at DESC
  `, [userId]);

  return result.rows;
}

async function getFeedByFollowing(userId, limit = 20, offset = 0) {
  const result = await pool.query(`
    SELECT 
      posts.id,
      posts.text,
      posts.image,
      posts.created_at,
      users.username,
      users.display_name,
      users.avatar,
      CASE 
        WHEN my_likes.user_id IS NOT NULL THEN true
        ELSE false
      END AS is_liked,
      COUNT(all_likes.id) AS likes_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    JOIN follows ON follows.following_id = users.id
    LEFT JOIN likes AS my_likes 
      ON my_likes.post_id = posts.id AND my_likes.user_id = $1
    LEFT JOIN likes AS all_likes 
      ON all_likes.post_id = posts.id
    WHERE follows.follower_id = $1
    GROUP BY posts.id, users.id, my_likes.user_id
    ORDER BY posts.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  return result.rows;
}

async function getPostsByUser(username, currentUserId) {
  const result = await pool.query(`
    SELECT 
      posts.id,
      posts.text,
      posts.image,
      posts.created_at,
      users.username,
      users.display_name,
      users.avatar,
      CASE 
        WHEN my_likes.user_id IS NOT NULL THEN true
        ELSE false
      END AS is_liked,
      COUNT(all_likes.id) AS likes_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    LEFT JOIN likes AS my_likes 
      ON my_likes.post_id = posts.id AND my_likes.user_id = $2
    LEFT JOIN likes AS all_likes 
      ON all_likes.post_id = posts.id
    WHERE users.username = $1
    GROUP BY posts.id, users.id, my_likes.user_id
    ORDER BY posts.created_at DESC
  `, [username, currentUserId]);

  return result.rows;
}

async function updatePostById(postId, userId, text) {
  const result = await pool.query(
    `UPDATE posts
     SET text = $1
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [text, postId, userId]
  );

  return result.rows[0];
}

async function deletePostById(postId, userId) {
  await pool.query(
    `DELETE FROM posts
     WHERE id = $1 AND user_id = $2`,
    [postId, userId]
  );
}

async function getMyPosts(userId, limit = 20, offset = 0) {
  const result = await pool.query(`
    SELECT 
      posts.id,
      posts.text,
      posts.image,
      posts.created_at,
      users.username,
      users.display_name,
      users.avatar,
      CASE 
        WHEN my_likes.user_id IS NOT NULL THEN true
        ELSE false
      END AS is_liked,
      COUNT(all_likes.id) AS likes_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    LEFT JOIN likes AS my_likes 
      ON my_likes.post_id = posts.id AND my_likes.user_id = $1
    LEFT JOIN likes AS all_likes 
      ON all_likes.post_id = posts.id
    WHERE posts.user_id = $1
    GROUP BY posts.id, users.id, my_likes.user_id
    ORDER BY posts.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  return result.rows;
}

async function getPopularPosts() {
  const result = await pool.query(`
    SELECT 
      posts.id,
      posts.text,
      posts.image,
      posts.created_at,
      users.username,
      users.display_name,
      users.avatar,
      COUNT(likes.id) AS likes_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    LEFT JOIN likes ON likes.post_id = posts.id
    GROUP BY posts.id, users.id
    ORDER BY likes_count DESC, posts.created_at DESC
    LIMIT 1
  `);

  return result.rows;
}

async function getPostLikes(postId) {
  const result = await pool.query(
    `
    SELECT 
      u.id,
      u.username,
      u.display_name,
      u.avatar
    FROM likes l
    JOIN users u ON u.id = l.user_id
    WHERE l.post_id = $1
    ORDER BY u.display_name ASC
    `,
    [postId]
  );

  return result.rows;
}

async function getPostById(postId) {
  const result = await pool.query(
    `
    SELECT 
      posts.id,
      posts.user_id,
      posts.text,
      posts.image,
      posts.created_at,
      users.username,
      users.display_name,
      users.avatar,
      COUNT(likes.id) AS likes_count
    FROM posts
    JOIN users ON users.id = posts.user_id
    LEFT JOIN likes ON likes.post_id = posts.id
    WHERE posts.id = $1
    GROUP BY posts.id, users.id
    `,
    [postId]
  );

  return result.rows[0];
}

async function getPostByIdFull(postId, currentUserId) {
  const result = await pool.query(
    `
    SELECT 
      posts.id,
      posts.user_id,
      posts.text,
      posts.image,
      posts.created_at,
      users.username,
      users.display_name,
      users.avatar,
      CASE 
        WHEN my_likes.user_id IS NOT NULL THEN true
        ELSE false
      END AS is_liked,
      COUNT(all_likes.id) AS likes_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    LEFT JOIN likes AS my_likes 
      ON my_likes.post_id = posts.id AND my_likes.user_id = $2
    LEFT JOIN likes AS all_likes 
      ON all_likes.post_id = posts.id
    WHERE posts.id = $1
    GROUP BY posts.id, users.id, my_likes.user_id
    `,
    [postId, currentUserId]
  );

  return result.rows[0];
}

module.exports = {
  createPost,
  getAllPosts,
  likePost,
  unlikePost,
  getLikedPosts,
  getFeedByFollowing,
  getPostsByUser,
  updatePostById,
  deletePostById,
  getMyPosts,
  getPopularPosts,
  getPostLikes,
  getPostById,
  getPostByIdFull,
  
};