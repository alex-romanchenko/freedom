// Run against Vite with VITE_GOOGLE_CLIENT_ID set and VITE_API_URL=<base>/api.
// Uses mocked GIS/API, not real Google credentials or production data.
/* global require, process */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || undefined });
  try {
    for (const scenario of ['register', 'link', 'cancel', 'failed-script', 'expired']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const calls = [];
      await page.addInitScript(() => localStorage.setItem('language', 'en'));
      await page.route('https://accounts.google.com/gsi/client', route => scenario === 'failed-script'
        ? route.abort() : route.fulfill({ contentType: 'text/javascript', body: `
        window.google = { accounts: { id: {
          initialize(options) { window.mockGoogleCallback = options.callback; },
          renderButton(node) { const b = document.createElement('button'); b.textContent = 'Mock Google';
            b.onclick = () => window.mockGoogleCallback({ credential: 'mock-id-token' }); node.appendChild(b); }
        } } };` }));
      await page.route(`${base}/api/**`, async route => {
        const request = route.request(); const path = new URL(request.url()).pathname;
        const body = request.postDataJSON(); calls.push({ path, body, headers: request.headers() });
        let status = 200; let data = [];
        if (path === '/api/auth/google') {
          if (scenario === 'link') { status = 409; data = { code: 'GOOGLE_LINK_REQUIRED' }; }
          else if (scenario === 'expired') { status = 401; data = { message: 'Invalid or expired Google ID token' }; }
          else if (!body.profile) data = { status: 'registration_required', profile: {
            email: 'test@gmail.com', suggestedDisplayName: 'A very long Google name' } };
          else data = { token: 'final-token', user: { id: 1, username: 'Tester', language: 'en' } };
        } else if (path === '/api/auth/login') {
          data = { token: 'password-token', user: { id: 1, username: 'Tester', language: 'en' } };
        } else if (path === '/api/auth/google/link') data = { message: 'Linked' };
        await route.fulfill({ status, json: data });
      });
      await page.goto(base);
      if (scenario === 'failed-script') {
        await page.getByText('Google sign-in is unavailable.', { exact: false }).waitFor();
        assert.equal(await page.locator('input[name="password"]').isVisible(), true);
      } else {
        await page.getByRole('button', { name: 'Mock Google' }).click();
        if (scenario === 'expired') {
          await page.getByRole('alert').filter({ hasText: 'Google session expired' }).waitFor();
        } else if (scenario === 'link') {
          await page.getByLabel('Email or username', { exact: true }).fill('Tester');
          await page.getByLabel('Password', { exact: true }).fill('password123');
          await page.getByRole('button', { name: 'Link Google and sign in' }).click();
          assert.equal(calls.some(c => c.path === '/api/auth/login'), false);
          await page.getByRole('checkbox').check();
          await page.getByRole('button', { name: 'Link Google and sign in' }).click();
          await page.waitForFunction(() => localStorage.getItem('token') === 'password-token');
          const link = calls.find(c => c.path === '/api/auth/google/link');
          assert.equal(link.headers.authorization, 'Bearer password-token');
          assert.equal(link.body.confirmLink, true);
        } else {
          await page.getByRole('heading', { name: 'Complete registration' }).waitFor();
          assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
          if (scenario === 'cancel') {
            await page.getByRole('button', { name: 'Cancel', exact: true }).click();
            assert.equal(await page.locator('input[name="password"]').isVisible(), true);
            assert.equal(calls.filter(c => c.path === '/api/auth/google').length, 1);
          } else {
            await page.getByLabel('Username', { exact: true }).fill('Tester');
            await page.getByLabel('Display name', { exact: true }).fill('Tester');
            await page.getByRole('checkbox').check();
            await page.getByRole('button', { name: 'Complete registration', exact: true }).click();
            await page.waitForFunction(() => localStorage.getItem('token') === 'final-token');
            assert.equal(calls.find(c => c.body?.profile)?.body.profile.acceptTerms, true);
          }
        }
      }
      console.log(`PASS ${scenario}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
