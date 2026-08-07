const SKIP_TYPES = new Set([
  'image/gif',
  'image/svg+xml',
  'image/heic',
  'image/heif',
]);

export async function compressImageFile(
  file,
  { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = {}
) {
  if (!file?.type?.startsWith('image/') || SKIP_TYPES.has(file.type)) {
    return file;
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = sourceUrl;
    });

    const scale = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    if (scale === 1 && file.type === 'image/jpeg' && file.size < 700 * 1024) {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );

    if (!blob || blob.size >= file.size) return file;

    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, '')}.jpg`,
      { type: 'image/jpeg', lastModified: Date.now() }
    );
  } catch (error) {
    console.warn('Image compression skipped:', error);
    return file;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
