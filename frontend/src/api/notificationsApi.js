import api from './api';

export async function getNotificationsApi(limit = 20, offset = 0) {
  const res = await api.get(`/notifications?limit=${limit}&offset=${offset}`);
  return res.data;
}

export async function markNotificationsReadApi() {
  const res = await api.put('/notifications/read');
  return res.data;
}

export async function deleteNotificationApi(id) {
  const res = await api.delete(`/notifications/${id}`);
  return res.data;
}