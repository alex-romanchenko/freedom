export const getFileUrl = (path) => {
  if (!path) return '';

  if (path.startsWith('http')) {
    return path;
  }

  return `${import.meta.env.VITE_SERVER_URL}${path}`;
};