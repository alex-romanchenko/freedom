import { useState } from 'react';
import { resetPasswordApi } from '../api/authApi';

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const token = new URLSearchParams(window.location.search).get('token');

  const resetPassword = async () => {
    try {
      if (!password || !confirmPassword) {
        setMessage('Please fill in both fields');
        return;
      }

      if (password !== confirmPassword) {
        setMessage('Passwords do not match');
        return;
      }

      await resetPasswordApi(token, password);

      setMessage('Password was reset successfully');

      setTimeout(() => {
        window.location.href = '/';
      }, 1200);
    } catch (err) {
      console.error(err);
      setMessage('Error resetting password');
    }
  };

  return (
    <div className="auth-page">
      <h1>Reset Password</h1>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
      />

      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm new password"
      />

      <button className="primary-btn" onClick={resetPassword}>
        Reset password
      </button>

      {message && <p className="username">{message}</p>}
    </div>
  );
}

export default ResetPassword;