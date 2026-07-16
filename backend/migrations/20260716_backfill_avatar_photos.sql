INSERT INTO photos (user_id, image, description)
SELECT u.id, u.avatar, ''
FROM users u
WHERE u.avatar IS NOT NULL
  AND BTRIM(u.avatar) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM photos p
    WHERE p.user_id = u.id
      AND p.image = u.avatar
  );
