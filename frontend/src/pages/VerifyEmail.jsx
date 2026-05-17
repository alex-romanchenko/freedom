import { useEffect, useState } from 'react';
import api from '../api/api';

function VerifyEmail() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      return;
    }

    api
      .get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="auth-page">
        <h1>Verifying email...</h1>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="auth-page">
        <h1>Email verified ✅</h1>
        <button
          className="primary-btn"
          onClick={() => {
            window.location.href = '/';
          }}
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Invalid or expired token ❌</h1>
    </div>
  );
}

export default VerifyEmail;