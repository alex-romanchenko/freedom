import api from './api';

export async function getMyProfileApi() {
  const res = await api.get('/users/me');
  return res.data;
}

export async function getUserProfileApi(username) {
  const res = await api.get(`/users/${username}`);
  return res.data;
}

export async function updateMyProfileApi(data) {
  const res = await api.put('/users/me', data);
  return res.data;
}

export async function updateAvatarApi(formData) {
  const res = await api.put('/users/me/avatar', formData);
  return res.data;
}

export async function updateHeaderApi(formData) {
  const res = await api.put('/users/me/header', formData);
  return res.data;
}

export async function updateLanguageApi(language) {
  const res = await api.put('/users/me/language', { language });
  return res.data;
}

export async function searchUsersApi(query) {
  const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
  return res.data;
}

export async function getWhoToFollowApi() {
  const res = await api.get('/users/who-to-follow');
  return res.data;
}
