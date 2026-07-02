import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('token') || sessionStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let authExpiredNotified = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const hasToken =
      Boolean(localStorage.getItem('token')) ||
      Boolean(sessionStorage.getItem('token'));
    const isAuthRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password') ||
      requestUrl.includes('/auth/resend-verification');

    if (status === 401 && hasToken && !isAuthRequest && !authExpiredNotified) {
      authExpiredNotified = true;
      window.dispatchEvent(new Event('authExpired'));

      setTimeout(() => {
        authExpiredNotified = false;
      }, 1000);
    }

    return Promise.reject(error);
  }
);

export default api;
