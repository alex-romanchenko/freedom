import api from './api';

export async function followUserApi(userId) {
  await api.post(`/follows/${userId}`);
}

export async function unfollowUserApi(userId) {
  await api.delete(`/follows/${userId}`);
}

export async function getFriendsApi() {
  const res = await api.get('/follows');
  return res.data;
}

export async function getUserFriendsApi(username) {
  const res = await api.get(`/follows/user/${username}`);
  return res.data;
}

export async function getIncomingRequestsApi() {
  const res = await api.get('/follows/requests/incoming');
  return res.data;
}

export async function markRequestsSeenApi() {
  await api.put('/follows/requests/seen');
}