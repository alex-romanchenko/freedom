import { useCallback, useState } from 'react';
import GoogleAuth from '../components/GoogleAuth';
import api from '../api/api';
import ForgotPassword from './ForgotPassword';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser } from 'react-icons/fi';
import { getStoredLanguage, t, translateServerMessage } from '../utils/i18n';

function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [authPage, setAuthPage] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState('');
  const [errors, setErrors] = useState({});
  const [language, setLanguage] = useState(getStoredLanguage());
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [googleActive, setGoogleActive] = useState(false);
  const finishLogin = useCallback((data) => {
    const user = { ...data.user, language: data.user?.language || language };
    localStorage.setItem('token', data.token);
    sessionStorage.removeItem('token');
    localStorage.setItem('language', user.language);
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new Event('languageChanged'));
    onLoginSuccess();
  }, [language, onLoginSuccess]);

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem('language', nextLanguage);
    window.dispatchEvent(new Event('languageChanged'));
    setAuthError('');
    setErrors({});
  };

  const validateField = (name, value) => {
    let error = '';

    if (name === 'username') {
      if (value && !/^[A-Za-z0-9]{3,15}$/.test(value)) {
        error = t('username_invalid', language);
      }
    }

    if (name === 'email') {
      if (value.includes(' ')) {
        error = t('email_spaces', language);
      } else if (
        value &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ) {
        error = t('invalid_email', language);
      }
    }

    if (name === 'password') {
      if (value.includes(' ')) {
        error = t('password_spaces', language);
      } else if (value.length < 6) {
        error = t('min_6', language);
      }
    }

    if (name === 'confirmPassword' && value !== form.password) {
      error = t('passwords_not_match', language);
    }

    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    validateField(name, value);
    if (name === 'password' && form.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: form.confirmPassword === value
          ? ''
          : t('passwords_not_match', language),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const usernameRegex = /^[A-Za-z0-9]{3,15}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!isLogin) {
      if (!acceptedTerms) {
        setAuthError(t('accept_terms_required', language));
        return;
      }

      if (!usernameRegex.test(form.username)) {
        setAuthError(t('username_invalid', language));
        return;
      }

      if (!emailRegex.test(form.email)) {
        setAuthError(t('enter_valid_email', language));
        return;
      }

      if (form.password.length < 6) {
        setAuthError(t('password_invalid', language));
        return;
      }

      if (form.password !== form.confirmPassword) {
        setAuthError(t('passwords_not_match', language));
        return;
      }
    }

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', {
          login: form.email,
          password: form.password,
          rememberMe,
        });

        finishLogin(res.data);
      } else {
        await api.post('/auth/register', {
          username: form.username,
          email: form.email,
          password: form.password,
          language,
          acceptTerms: acceptedTerms,
        });

        setAuthError(t('registered_confirm_email', language));
        setIsLogin(true);
      }
    } catch (err) {
      console.error(err);
      setAuthError(
        translateServerMessage(
          err.response?.data?.message || t('login_error', language),
          language
        )
      );
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

      setAuthError(translateServerMessage(res.data.message, language));
    } catch (err) {
      setAuthError(
        translateServerMessage(
          err.response?.data?.message || t('resend_error', language),
          language
        )
      );
    }
  };

  const isSuccessMessage = authError === t('registered_confirm_email', language);
  const canSubmit = isLogin
    ? form.email.trim().length > 0 && form.password.length >= 6
    : form.username.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.password.length >= 6 &&
      form.confirmPassword === form.password &&
      acceptedTerms;

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
            {isLogin ? t('login_title', language) : t('register_title', language)}
          </h2>

          <GoogleAuth language={language} onSession={finishLogin} onActiveChange={setGoogleActive} />
          <div hidden={googleActive}>
          {authError && (
            <div className={isSuccessMessage ? 'success-message' : 'error-message'}>
              {authError}
            </div>
          )}

          {isSuccessMessage && (
            <button className="link-btn" onClick={resendVerification}>
              {t('resend_verification', language)}
            </button>
          )}

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div className="input-with-icon">
                  <FiUser className="input-icon" />
                  <input
                    name="username"
                    minLength={3}
                    maxLength={15}
                    placeholder={t('username', language)}
                    value={form.username}
                    onChange={handleChange}
                  />
                </div>
                {errors.username && <p className="input-error">{errors.username}</p>}

              </>
            )}

            <div className="input-with-icon">
              <FiMail className="input-icon" />
              <input
                name="email"
                placeholder={isLogin ? t('email_or_username', language) : t('email', language)}
                value={form.email}
                onChange={handleChange}
              />
            </div>
            {errors.email && <p className="input-error">{errors.email}</p>}

            <div className="input-with-icon">
              <FiLock className="input-icon" />

              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('password', language)}
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
            {errors.password && <p className="input-error">{errors.password}</p>}

            {!isLogin && (
              <>
                <div className="input-with-icon">
                  <FiLock className="input-icon" />
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={t('confirm_password', language)}
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="input-error">{errors.confirmPassword}</p>
                )}
              </>
            )}

            {!isLogin && (
              <label className="auth-legal-consent">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => {
                    setAcceptedTerms(event.target.checked);
                    setAuthError('');
                  }}
                />
                <span>
                  {t('agree_to', language)}{' '}
                  <a href="/terms.html" target="_blank" rel="noreferrer">
                    {t('terms_of_use', language)}
                  </a>{' '}
                  {t('and', language)}{' '}
                  <a href="/privacy.html" target="_blank" rel="noreferrer">
                    {t('privacy_policy', language)}
                  </a>
                </span>
              </label>
            )}

            {isLogin && (
              <div className="auth-row">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setAuthPage('forgot')}
                >
                  {t('forgot_password', language)}
                </button>

                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  {t('remember_me', language)}
                </label>
              </div>
            )}

            <button
              type="submit"
              className="primary-btn auth-main-btn"
              disabled={!canSubmit}
            >
              {isLogin ? t('login', language) : t('create_account', language)}
            </button>
          </form>

          {isLogin ? (
            <>
              <p className="auth-switch-text">{t('dont_have_account', language)}</p>

              <button
                className="secondary-btn"
                onClick={() => {
                  setAuthError('');
                  setIsLogin(false);
                }}
              >
                {t('create_new_account', language)}
              </button>
            </>
          ) : (
            <>
              <p className="auth-switch-text">{t('already_have_account', language)}</p>

              <button
                className="secondary-btn"
                onClick={() => {
                  setAuthError('');
                  setIsLogin(true);
                }}
              >
                {t('login', language)}
              </button>
            </>
          )}

          </div>
          <div className="language-switcher auth-language-switcher">
            {['en', 'uk', 'ru'].map((item) => (
              <button
                key={item}
                type="button"
                className={language === item ? 'active' : ''}
                onClick={() => changeLanguage(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
