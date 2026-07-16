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

async function upsertAvatarPhoto(userId, image) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `
      SELECT id
      FROM photos
      WHERE user_id = $1
        AND image LIKE '/uploads/avatars/%'
      ORDER BY created_at DESC, id DESC
      `,
      [userId]
    );

    let photo;
    if (existing.rows.length === 0) {
      const inserted = await client.query(
        `
        INSERT INTO photos (user_id, image, description)
        VALUES ($1, $2, '')
        RETURNING *
        `,
        [userId, image]
      );
      photo = inserted.rows[0];
    } else {
      const primaryId = existing.rows[0].id;
      const updated = await client.query(
        `
        UPDATE photos
        SET image = $1, description = ''
        WHERE id = $2
        RETURNING *
        `,
        [image, primaryId]
      );
      photo = updated.rows[0];

      const duplicateIds = existing.rows.slice(1).map((row) => row.id);
      if (duplicateIds.length > 0) {
        await client.query(
          'DELETE FROM photo_likes WHERE photo_id = ANY($1::int[])',
          [duplicateIds]
        );
        await client.query(
          'DELETE FROM photo_comments WHERE photo_id = ANY($1::int[])',
          [duplicateIds]
        );
        await client.query('DELETE FROM photos WHERE id = ANY($1::int[])', [
          duplicateIds,
        ]);
      }
    }

    await client.query('COMMIT');
    return photo;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
      AND p.image NOT LIKE '/uploads/avatars/%'

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
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const ownedPhoto = await client.query(
      'SELECT * FROM photos WHERE id = $1 AND user_id = $2',
      [photoId, userId]
    );
    if (!ownedPhoto.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('DELETE FROM photo_likes WHERE photo_id = $1', [photoId]);
    await client.query('DELETE FROM photo_comments WHERE photo_id = $1', [
      photoId,
    ]);
    await client.query('DELETE FROM photos WHERE id = $1', [photoId]);
    await client.query('COMMIT');
    return ownedPhoto.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getAvatarPhotoByUserId(userId, currentUserId) {
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
      true AS is_avatar,
      EXISTS (
        SELECT 1
        FROM photo_likes
        WHERE photo_id = p.id AND user_id = $2
      ) AS is_liked,
      COUNT(DISTINCT pl.id)::int AS likes_count,
      COUNT(DISTINCT pc.id)::int AS comments_count
    FROM photos p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN photo_likes pl ON pl.photo_id = p.id
    LEFT JOIN photo_comments pc ON pc.photo_id = p.id
    WHERE p.user_id = $1
      AND p.image = u.avatar
    GROUP BY p.id, u.id
    LIMIT 1
    `,
    [userId, currentUserId]
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
      (p.image = u.avatar) AS is_avatar,
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
  upsertAvatarPhoto,
  getPhotosByUserId,
  updatePhotoDescription,
  deletePhoto,
  getAvatarPhotoByUserId,
  getPhotoById,
};
