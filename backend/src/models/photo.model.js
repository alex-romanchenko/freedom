const db = require('../db');

async function createPhoto(userId, image, description) {
  const result = await db.query(
    `
    INSERT INTO photos (user_id, image, description)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [userId, image, description]
  );

  return result.rows[0];
}

async function getPhotosByUserId(userId, currentUserId) {
  const result = await db.query(
    `
    SELECT 
      p.*,
      u.username,
      u.display_name,
      u.avatar,

      COUNT(DISTINCT pl.id) AS likes_count,
      COUNT(DISTINCT pc.id) AS comments_count,

      EXISTS (
        SELECT 1 
        FROM photo_likes 
        WHERE photo_id = p.id AND user_id = $2
      ) AS is_liked

    FROM photos p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN photo_likes pl ON pl.photo_id = p.id
    LEFT JOIN photo_comments pc ON pc.photo_id = p.id

    WHERE p.user_id = $1

    GROUP BY p.id, u.id
    ORDER BY p.created_at DESC
    `,
    [userId, currentUserId]
  );

  return result.rows;
}

async function updatePhotoDescription(photoId, userId, description) {
  const result = await db.query(
    `
    UPDATE photos
    SET description = $1
    WHERE id = $2 AND user_id = $3
    RETURNING *
    `,
    [description, photoId, userId]
  );

  return result.rows[0];
}

async function deletePhoto(photoId, userId) {
  const result = await db.query(
    `
    DELETE FROM photos
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [photoId, userId]
  );

  return result.rows[0];
}

async function getPhotoById(photoId, currentUserId) {
  const result = await db.query(
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
      CASE 
        WHEN my_likes.user_id IS NOT NULL THEN true
        ELSE false
      END AS is_liked,
      COUNT(DISTINCT all_likes.id)::int AS likes_count,
      COUNT(DISTINCT pc.id)::int AS comments_count
    FROM photos p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN photo_likes AS my_likes
      ON my_likes.photo_id = p.id AND my_likes.user_id = $2
    LEFT JOIN photo_likes AS all_likes
      ON all_likes.photo_id = p.id
    LEFT JOIN photo_comments pc
      ON pc.photo_id = p.id
    WHERE p.id = $1
    GROUP BY p.id, u.id, my_likes.user_id
    `,
    [photoId, currentUserId]
  );

  return result.rows[0];
}

module.exports = {
  createPhoto,
  getPhotosByUserId,
  updatePhotoDescription,
  deletePhoto,
  getPhotoById,
};