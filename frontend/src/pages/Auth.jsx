import { useState } from 'react';
import api from '../api/api';
import ForgotPassword from './ForgotPassword';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiUsers } from 'react-icons/fi';

function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [authPage, setAuthPage] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState('');

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', {
          login: form.email,
          password: form.password,
          rememberMe,
        });

        localStorage.setItem('token', res.data.token);
        sessionStorage.removeItem('token');

        localStorage.setItem('user', JSON.stringify(res.data.user));

        onLoginSuccess();
      } else {
        await api.post('/auth/register', form);

        setAuthError('Registered! Please check your mailbox and confirm your email.');
        setIsLogin(true);
      }
    } catch (err) {
      console.error(err);
      setAuthError(err.response?.data?.message || 'Login error');
    }
  };

  if (authPage === 'forgot') {
    return <ForgotPassword onBack={() => setAuthPage('login')} />;
  }

  const resendVerification = async () => {
  setAuthError('');

  try {
    const res = await api.post('/auth/resend-verification', {
      email: form.email,
    });

    setAuthError(res.data.message);
  } catch (err) {
    setAuthError(err.response?.data?.message || 'Error resending email');
  }
};

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <img
          src="/images/freedom-auth.jpg"
          alt="Freedom social network"
          className="auth-image"
        />
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <h2 className="auth-title">
            {isLogin ? 'Login to Freedom' : 'Create your Freedom account'}
          </h2>

            {authError && (
              <div
                className={
                  authError.includes('mailbox')
                    ? 'success-message'
                    : 'error-message'
                }
              >
                {authError}
              </div>
            )}
            {authError.includes('mailbox') && (
            <button
                className="link-btn"
                onClick={resendVerification}
            >
                Resend verification email
            </button>
            )}
            <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
            <div className="input-with-icon">
              <FiUser className="input-icon" />
              <input
                name="username"
                placeholder="Username"
                value={form.username}
                onChange={handleChange}
              />
            </div>

              <div className="input-with-icon">
                <FiUsers className="input-icon" />
                <input
                  name="displayName"
                  placeholder="Display Name"
                  value={form.displayName}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          <div className="input-with-icon">
            <FiMail className="input-icon" />
            <input
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className="input-with-icon">
            <FiLock className="input-icon" />

            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
            />

            <button
              type="button"
              className="eye-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          
          {isLogin && (
            <div className="auth-row">
              <button
              type="button"
                className="link-btn"
                onClick={() => setAuthPage('forgot')}
              >
                Forgot your password?
              </button>

              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
            </div>
          )}

          <button type="submit" className="primary-btn auth-main-btn">
            {isLogin ? 'Login' : 'Create account'}
          </button>
            </form>
          {isLogin ? (
            <>
              <p className="auth-switch-text">Don’t have an account?</p>

              <button
                className="secondary-btn"
                onClick={() => {
                  setAuthError('');
                  setIsLogin(false);
                }}
              >
                Create new account
              </button>
            </>
          ) : (
            <>
              <p className="auth-switch-text">Already have an account?</p>

              <button
                className="secondary-btn"
                onClick={() => {
                  setAuthError('');
                  setIsLogin(true);
                }}
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;