import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { t, translateServerMessage } from '../utils/i18n';
import { loadGoogleIdentity, renderGoogleButton } from '../utils/googleIdentity';

const text = {
  uk: {
    complete: 'Завершити реєстрацію', cancel: 'Скасувати', loading: 'Зачекай…',
    unavailable: 'Google-вхід недоступний. Спробуй ще раз або увійди за паролем.',
    retry: 'Спробувати ще раз', link: 'Прив’язати Google та увійти',
    explain: 'Цей email уже зареєстрований. Введи email або username та поточний пароль Freedom, щоб прив’язати обраний Google-акаунт.',
    confirm: 'Підтверджую прив’язування обраного Google-акаунта до мого акаунта Freedom.',
    failed: 'Не вдалося виконати вхід. Перевір дані та спробуй ще раз.',
    expired: 'Google-сесія закінчилась. Скасуй цей крок і знову обери Google-акаунт.',
    conflict: 'Username або email уже зайнятий. Зміни username або повернись до входу.',
    emailFirst: 'Спочатку зареєструйся через email і підтвердь пошту, потім прив’яжи Google.',
    hint: 'Username: 2–10 латинських літер. Ім’я: 2–10 літер або пробілів.',
  },
  en: {
    complete: 'Complete registration', cancel: 'Cancel', loading: 'Please wait…',
    unavailable: 'Google sign-in is unavailable. Retry or sign in with your password.',
    retry: 'Try again', link: 'Link Google and sign in',
    explain: 'This email is already registered. Enter your Freedom email or username and current password to link the selected Google account.',
    confirm: 'I confirm linking the selected Google account to my Freedom account.',
    failed: 'Sign-in failed. Check your details and try again.',
    expired: 'Google session expired. Cancel this step and select your Google account again.',
    conflict: 'Username or email is already in use. Change the username or return to sign-in.',
    emailFirst: 'Register using email and verify your mailbox first, then link Google.',
    hint: 'Username: 2–10 Latin letters. Display name: 2–10 letters or spaces.',
  },
  ru: {
    complete: 'Завершить регистрацию', cancel: 'Отмена', loading: 'Подожди…',
    unavailable: 'Вход через Google недоступен. Попробуй снова или войди по паролю.',
    retry: 'Попробовать снова', link: 'Привязать Google и войти',
    explain: 'Этот email уже зарегистрирован. Введи email или username и текущий пароль Freedom для привязки выбранного Google-аккаунта.',
    confirm: 'Подтверждаю привязку выбранного Google-аккаунта к моему аккаунту Freedom.',
    failed: 'Не удалось войти. Проверь данные и попробуй снова.',
    expired: 'Google-сессия истекла. Отмени этот шаг и снова выбери Google-аккаунт.',
    conflict: 'Username или email уже занят. Измени username или вернись ко входу.',
    emailFirst: 'Сначала зарегистрируйся через email и подтверди почту, затем привяжи Google.',
    hint: 'Username: 2–10 латинских букв. Имя: 2–10 букв или пробелов.',
  },
};

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleAuth({ language, onSession, onActiveChange }) {
  const words = text[language] || text.en;
  const button = useRef(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const [mode, setMode] = useState('button');
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [idToken, setIdToken] = useState('');
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState({ username: '', displayName: '', acceptTerms: false });
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmLink, setConfirmLink] = useState(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    onActiveChange(mode !== 'button' || busy);
    return () => onActiveChange(false);
  }, [mode, busy, onActiveChange]);

  const showError = useCallback((err, googleRequest = true) => {
    const code = err.response?.data?.code;
    setError(code === 'ACCOUNT_CONFLICT' ? words.conflict :
      code === 'EMAIL_REGISTRATION_REQUIRED' ? words.emailFirst :
      googleRequest && err.response?.status === 401 ? words.expired :
      translateServerMessage(err.response?.data?.message || words.failed, language));
  }, [language, words]);

  const receiveCredential = useCallback(async ({ credential }) => {
    if (!credential || pending.current || !mounted.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/google', { idToken: credential });
      if (!mounted.current) return;
      if (data.status === 'registration_required') {
        setIdToken(credential); setEmail(data.profile.email);
        setProfile({ username: '', displayName: data.profile.suggestedDisplayName || '', acceptTerms: false });
        setMode('register');
      } else if (data.token && data.user) onSession(data);
      else setError(words.failed);
    } catch (err) {
      if (!mounted.current) return;
      if (err.response?.data?.code === 'GOOGLE_LINK_REQUIRED') {
        setIdToken(credential); setPassword(''); setConfirmLink(false); setMode('link');
      } else showError(err);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [onSession, showError, words]);

  useEffect(() => {
    if (!clientId || mode !== 'button') return;
    let cancelled = false;
    let cleanup;
    loadGoogleIdentity().then(google => {
      if (!cancelled && button.current) {
        setLoadFailed(false);
        cleanup = renderGoogleButton(google, button.current, clientId, language, receiveCredential);
      }
    }).catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; cleanup?.(); };
  }, [language, mode, retry, receiveCredential]);

  const cancel = () => {
    setMode('button'); setIdToken(''); setPassword(''); setConfirmLink(false);
    setProfile({ username: '', displayName: '', acceptTerms: false }); setError('');
  };

  const submit = async event => {
    event.preventDefault();
    if (pending.current) return;
    if (mode === 'register' && (!/^[A-Za-z]{2,10}$/.test(profile.username) ||
      !/^[A-Za-zА-Яа-яІіЇїЄєҐґ\s]{2,10}$/.test(profile.displayName) ||
      !profile.displayName.trim() || !profile.acceptTerms)) { setError(words.hint); return; }
    if (mode === 'link' && (!login.trim() || !password || !confirmLink)) return;
    pending.current = true; setBusy(true); setError('');
    let googleRequest = mode !== 'link';
    try {
      if (mode === 'register') {
        const { data } = await api.post('/auth/google', { idToken, profile: { ...profile, language } });
        if (mounted.current) onSession(data);
      } else {
        // Keep the password-login session in memory until linking succeeds.
        const { data } = await api.post('/auth/login', { login: login.trim(), password });
        googleRequest = true;
        await api.post('/auth/google/link', { idToken, password, confirmLink: true }, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (mounted.current) onSession(data);
      }
    } catch (err) { if (mounted.current) showError(err, googleRequest); }
    finally { pending.current = false; if (mounted.current) { setBusy(false); setPassword(''); } }
  };

  if (!clientId) return null;
  return <section className="google-auth" aria-busy={busy}>
    {error && <p role="alert" className="error-message">{error}</p>}
    {mode === 'button' ? <>
      <div ref={button} className="google-auth-button" inert={busy} />
      {loadFailed && <p role="status">{words.unavailable} <button type="button" className="link-btn"
        onClick={() => setRetry(value => value + 1)}>{words.retry}</button></p>}
    </> : <form onSubmit={submit}>
      <h3>{mode === 'register' ? words.complete : words.link}</h3>
      <fieldset disabled={busy}>
        {mode === 'register' ? <>
          <p className="google-auth-email">{email}</p>
          <p>{words.hint}</p>
          <label>{t('username', language)}<input autoComplete="username" required value={profile.username}
            onChange={e => setProfile({ ...profile, username: e.target.value })} /></label>
          <label>{t('display_name', language)}<input required value={profile.displayName}
            onChange={e => setProfile({ ...profile, displayName: e.target.value })} /></label>
          <label className="auth-legal-consent"><input type="checkbox" required checked={profile.acceptTerms}
            onChange={e => setProfile({ ...profile, acceptTerms: e.target.checked })} />
            <span>{t('agree_to', language)} <a href="/terms.html" target="_blank" rel="noreferrer">{t('terms_of_use', language)}</a>
              {' '}{t('and', language)} <a href="/privacy.html" target="_blank" rel="noreferrer">{t('privacy_policy', language)}</a></span>
          </label>
        </> : <>
          <p>{words.explain}</p>
          <label>{t('email_or_username', language)}<input autoComplete="username" required value={login}
            onChange={e => setLogin(e.target.value)} /></label>
          <label>{t('password', language)}<input type="password" autoComplete="current-password" required
            value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label className="auth-legal-consent"><input type="checkbox" required checked={confirmLink}
            onChange={e => setConfirmLink(e.target.checked)} /><span>{words.confirm}</span></label>
        </>}
        <button type="submit" className="primary-btn auth-main-btn">{mode === 'register' ? words.complete : words.link}</button>
        <button type="button" className="secondary-btn" onClick={cancel}>{words.cancel}</button>
      </fieldset>
    </form>}
    {busy && <p role="status">{words.loading}</p>}
  </section>;
}
