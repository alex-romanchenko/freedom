const db = require('../db');

async function likePhoto(userId, photoId) {
  await db.query(
    `
    INSERT INTO photo_likes (user_id, photo_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, photo_id) DO NOTHING
    `,
    [userId, photoId]
  );
}

async function unlikePhoto(userId, photoId) {
  await db.query(
    `
    DELETE FROM photo_likes
    WHERE user_id = $1 AND photo_id = $2
    `,
    [userId, photoId]
  );
}

async function getPhotoLikes(photoId) {
  const result = await db.query(
    `
    SELECT u.id, u.username, u.display_name, u.avatar
    FROM photo_likes pl
    JOIN users u ON u.id = pl.user_id
    WHERE pl.photo_id = $1
    `,
    [photoId]
  );

  return result.rows;
}

module.exports = {
  likePhoto,
  unlikePhoto,
  getPhotoLikes,
};