import api from './api';

export async function forgotPasswordApi(email) {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data;
}

export async function resetPasswordApi(token, password) {
  const res = await api.post(`/auth/reset-password?token=${token}`, {
    password,
  });

  return res.data;
}