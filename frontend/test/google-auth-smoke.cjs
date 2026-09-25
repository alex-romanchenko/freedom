// Run against Vite with VITE_GOOGLE_CLIENT_ID set and VITE_API_URL=<base>/api.
// Uses mocked GIS/API, not real Google credentials or production data.
/* global require, process */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5177';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || undefined });
  try {
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      let registration;
      await page.route('https://accounts.google.com/gsi/client', route => route.abort());
      await page.route(`${base}/api/auth/register`, async route => {
        registration = route.request().postDataJSON();
        await route.fulfill({ status: 201, json: { message: 'created' } });
      });
      await page.goto(base);
      await page.getByRole('button', { name: 'Create new account' }).click();
      assert.equal(await page.getByLabel('Display name', { exact: true }).count(), 0);
      await page.locator('input[name="username"]').fill('Tester');
      await page.locator('input[name="email"]').fill('tester@example.com');
      await page.locator('input[name="password"]').fill('password123');
      await page.locator('input[name="confirmPassword"]').fill('different');
      assert.equal(await page.getByRole('button', { name: 'Create account' }).isDisabled(), true);
      await page.locator('input[name="confirmPassword"]').fill('password123');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.waitForFunction(() => document.body.textContent.includes('Registered!'));
      assert.deepEqual(registration, {
        username: 'Tester', email: 'tester@example.com', password: 'password123',
        language: 'en', acceptTerms: true,
      });
      console.log('PASS email registration');
      await page.close();
    }
    for (const scenario of ['register', 'username-conflict', 'link', 'cancel', 'failed-script', 'expired']) {
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
            email: 'test@gmail.com' } };
          else if (scenario === 'username-conflict') {
            status = 409; data = { code: 'ACCOUNT_CONFLICT' };
          }
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
          await page.getByText('Create your own unique username using Latin letters', { exact: true }).waitFor();
          assert.equal(await page.getByText('test@gmail.com', { exact: true }).count(), 0);
          assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
          if (scenario === 'cancel') {
            await page.getByRole('button', { name: 'Cancel', exact: true }).click();
            assert.equal(await page.locator('input[name="password"]').isVisible(), true);
            assert.equal(calls.filter(c => c.path === '/api/auth/google').length, 1);
          } else {
            await page.getByLabel('Username', { exact: true }).fill('a_1');
            await page.getByRole('checkbox').check();
            await page.getByRole('button', { name: 'Complete registration', exact: true }).click();
            await page.getByRole('alert').filter({ hasText: 'Username must be 3–15 Latin characters' }).waitFor();
            await page.getByRole('button', { name: 'UK', exact: true }).click();
            await page.getByRole('alert').filter({ hasText: 'Юзернейм має містити 3–15 латинських символів' }).waitFor();
            await page.getByText('Створіть власний унікальний юзернейм латинськими літерами', { exact: true }).waitFor();
            await page.getByRole('button', { name: 'EN', exact: true }).click();
            await page.getByLabel('Username', { exact: true }).fill('Tester');
            await page.getByRole('checkbox').check();
            await page.getByRole('button', { name: 'Complete registration', exact: true }).click();
            if (scenario === 'username-conflict') {
              await page.getByRole('alert').filter({ hasText: 'Username is taken.' }).waitFor();
              await page.getByRole('button', { name: 'UK', exact: true }).click();
              await page.getByRole('alert').filter({ hasText: 'Юзернейм зайнятий.' }).waitFor();
            } else {
              await page.waitForFunction(() => localStorage.getItem('token') === 'final-token');
              assert.equal(calls.find(c => c.body?.profile)?.body.profile.acceptTerms, true);
            }
          }
        }
      }
      console.log(`PASS ${scenario}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
