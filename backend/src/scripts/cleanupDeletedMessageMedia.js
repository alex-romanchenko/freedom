const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function cleanupDeletedMessageMedia() {
  let deletedFiles = 0;
  let updatedMessages = 0;

  try {
    const result = await pool.query(`
      SELECT id, image, video
      FROM messages
      WHERE is_deleted = true
        AND deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days'
        AND (
          image IS NOT NULL
          OR video IS NOT NULL
        )
    `);

    console.log(`Found messages: ${result.rows.length}`);

    for (const message of result.rows) {
      const files = [message.image, message.video];

      for (const file of files) {
        if (!file) continue;

        const filePath = path.join(__dirname, '..', '..', 'public', file);

        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles++;
            console.log('Deleted file:', filePath);
          } else {
            console.log('File not found:', filePath);
          }
        } catch (err) {
          console.error('File delete error:', err.message);
        }
      }

      await pool.query(
        `
        UPDATE messages
        SET image = NULL,
            video = NULL
        WHERE id = $1
        `,
        [message.id]
      );

      updatedMessages++;
    }

    console.log(`Updated messages: ${updatedMessages}`);
    console.log(`Deleted files: ${deletedFiles}`);
    console.log('Cleanup finished');

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

cleanupDeletedMessageMedia();