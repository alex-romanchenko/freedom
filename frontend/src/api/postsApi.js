import api from './api';

export async function getFeedPosts() {
  const res = await api.get('/posts');
  return res.data;
}

export async function createPostApi(formData) {
  const res = await api.post('/posts', formData);
  return res.data;
}

export async function likePostApi(postId) {
  await api.post(`/posts/${postId}/like`);
}

export async function unlikePostApi(postId) {
  await api.delete(`/posts/${postId}/like`);
}

export async function getFavoritePostsApi() {
  const res = await api.get('/posts/favorites');
  return res.data;
}

export async function updatePostApi(postId, data) {
  const res = await api.put(`/posts/${postId}`, data);
  return res.data;
}

export async function deletePostApi(postId) {
  const res = await api.delete(`/posts/${postId}`);
  return res.data;
}

export async function getMyPostsApi(limit = 20, offset = 0) {
  const res = await api.get(`/posts/my?limit=${limit}&offset=${offset}`);
  return res.data;
}

export async function getFollowingPostsApi(limit = 20, offset = 0) {
  const res = await api.get(`/posts?limit=${limit}&offset=${offset}`);
  return res.data;
}

export async function getPopularPostsApi() {
  const res = await api.get('/posts/popular');
  return res.data;
}

export async function getPostByIdApi(postId) {
  const res = await api.get(`/posts/${postId}`);
  return res.data;
}