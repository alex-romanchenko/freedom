/*
 * Run after migration 20260811_add_message_video_aspect_ratio.sql:
 *   node scripts/backfill-message-video-aspect-ratios.js
 *
 * Requires ffprobe (part of FFmpeg) to be installed on the server.
 */
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../src/db');

const execFileAsync = promisify(execFile);
const uploadsRoot = path.resolve(__dirname, '../public/uploads');
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';

function localPathForVideo(videoPath) {
  const relativePath = String(videoPath || '')
    .replace(/^\/+uploads\//, '')
    .replaceAll('/', path.sep);
  const resolvedPath = path.resolve(uploadsRoot, relativePath);

  if (!resolvedPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error(`Unsafe video path: ${videoPath}`);
  }
  return resolvedPath;
}

async function readAspectRatio(filePath) {
  const { stdout } = await execFileAsync(ffprobe, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:stream_side_data=rotation',
    '-of',
    'json',
    filePath,
  ]);
  const stream = JSON.parse(stdout).streams?.[0];
  let width = Number(stream?.width);
  let height = Number(stream?.height);
  const rotation = Number(stream?.side_data_list?.[0]?.rotation || 0);

  if (!width || !height) throw new Error('Video dimensions are unavailable');
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];

  return width / height;
}

async function main() {
  const { rows } = await pool.query(`
    SELECT DISTINCT video
    FROM messages
    WHERE video IS NOT NULL
      AND video_aspect_ratio IS NULL
      AND is_deleted = false
  `);

  let updated = 0;
  let skipped = 0;
  for (const { video } of rows) {
    try {
      const filePath = localPathForVideo(video);
      await fs.access(filePath);
      const aspectRatio = await readAspectRatio(filePath);
      await pool.query(
        `UPDATE messages
         SET video_aspect_ratio = $1
         WHERE video = $2 AND video_aspect_ratio IS NULL`,
        [aspectRatio, video]
      );
      updated += 1;
    } catch (error) {
      skipped += 1;
      console.warn(`Skipped ${video}: ${error.message}`);
    }
  }

  console.log(`Backfill complete: ${updated} videos updated, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error('Video aspect-ratio backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
