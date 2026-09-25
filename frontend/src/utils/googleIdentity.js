let loading;
let activeCallback;
let initializedClient;

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timeout = window.setTimeout(fail, 15000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      loading = undefined;
      reject(new Error('Google sign-in could not load'));
    }
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (!window.google?.accounts?.id) return fail();
      resolve(window.google.accounts.id);
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function renderGoogleButton(google, node, clientId, language, callback) {
  activeCallback = callback;
  if (initializedClient !== clientId) {
    google.initialize({ client_id: clientId, auto_select: false, ux_mode: 'popup',
      callback: result => activeCallback?.(result) });
    initializedClient = clientId;
  }
  node.replaceChildren();
  google.renderButton(node, { type: 'standard', theme: 'outline', size: 'large',
    text: 'continue_with', locale: language, width: Math.min(node.clientWidth || 280, 400) });
  return () => { if (activeCallback === callback) activeCallback = undefined; node.replaceChildren(); };
}
