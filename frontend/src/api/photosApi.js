import api from './api';

export async function getPhotoByIdApi(photoId) {
  const res = await api.get(`/photos/${photoId}`);
  return res.data;
}