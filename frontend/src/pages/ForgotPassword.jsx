import { useState } from 'react';
import { forgotPasswordApi } from '../api/authApi';

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const sendResetLink = async () => {
    try {
      await forgotPasswordApi(email);
      setMessage('Reset link was sent to your email');
    } catch (err) {
      console.error(err);
      setMessage('Error sending reset link, email address is not found');
    }
  };

  return (
    <div className="auth-page">
      <h1>Forgot Password</h1>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
      />

      <button className="primary-btn" onClick={sendResetLink}>
        Send reset link
      </button>

      {message && <p className="username">{message}</p>}

      <br />

      <button className="secondary-btn" onClick={onBack}>
        Back to login
      </button>
    </div>
  );
}

export default ForgotPassword;