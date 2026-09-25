# Google authentication (backend)

Not deployed automatically. Website UI is implemented; Flutter integration is still required.

## Website build

Set VITE_GOOGLE_CLIENT_ID to the same Web client ID in frontend/.env before building.
See frontend/.env.example. Without it the Google button is intentionally hidden.
VITE_API_URL must point at the deployed backend API. Build with `npm ci` and
`npm run build` inside frontend, and deploy the generated dist directory to your
existing web root. Do not upload local .env over the server's .env.

The Google button loads the official GIS script; CSP, if enabled, must allow Google's
documented GIS script/frame/connect origins. Local testing also requires the exact
localhost origin in Google Console and GOOGLE_ALLOWED_ORIGINS on the backend.
The UI keeps Google credentials and the temporary linking session only in memory;
it stores the final Freedom session using the existing password-login mechanism.
It never links accounts without the user checking the explicit confirmation box.

Browser smoke tests: frontend/test/google-auth-smoke.cjs uses Playwright with mocked
Google/API responses. Start Vite on 127.0.0.1:5177 with VITE_GOOGLE_CLIENT_ID set
and VITE_API_URL=http://127.0.0.1:5177/api, then run the script with Node.
PLAYWRIGHT_MODULE can point to an installed Playwright module; TEST_BROWSER_CHANNEL
may be chrome if bundled Chromium is unavailable. Tests cover registration, linking
with explicit consent, cancellation, script failure and expired-token feedback.

## Deployment preparation

1. Back up the database. Check case-insensitive email duplicates:
   `SELECT lower(email), count(*) FROM users GROUP BY lower(email) HAVING count(*) > 1;`
   Resolve any duplicates manually; do not delete accounts blindly.
2. Apply `migrations/20260925_add_google_auth.sql` with psql `-v ON_ERROR_STOP=1`.
   The migration is transactional and preserves existing passwords and profiles.
3. Install backend dependencies with `npm ci` (Node >=18).
4. Add to backend environment (do not commit actual .env):

   ```dotenv
   GOOGLE_WEB_CLIENT_ID=819091584046-rcfr6utmaa06c2v4mltg7lbrlqsm744c.apps.googleusercontent.com
   GOOGLE_ALLOWED_ORIGINS=https://myfreedomchat.org
   ```

   Existing JWT_SECRET, JWT_EXPIRES_IN, DB_* settings are still used.
   No Google client secret is needed. Android must request its ID token with this
   Web ID as serverClientId; Android client IDs identify package/signing certificates.
5. Run `npm test`, restart the backend, then test with real Google accounts.
   Configure a shared reverse-proxy rate limit for these routes for multi-worker deployments.
   The built-in 20 requests/minute limit is per process and req.ip. Behind an unconfigured
   trusted proxy it may group users under the proxy IP. Never trust arbitrary X-Forwarded-For.

## API contract

All calls use HTTPS JSON POST from an intentional Google sign-in action.
Use the GIS JavaScript callback, not HTML form POST/redirect mode. The API does not
set session cookies; clients receive Freedom JWT and send it as Bearer authorization.
Browser Origin is checked; native clients may omit Origin.

### POST /api/auth/google

Body: `{ "idToken": "<Google ID token>" }`.

- Linked Google `sub`: 200, same `{ message, token, user }` shape as password login.
- New identity: 200 `{ status: "registration_required", profile: { email, suggestedDisplayName } }`.
  No account/session is created yet. Name is a suggestion, not a validated Freedom name.
- Existing email: 409 `GOOGLE_LINK_REQUIRED`; sign in normally, then explicitly link.
- Non-Gmail/non-Workspace new email: 403 `EMAIL_REGISTRATION_REQUIRED`; register and
  verify the mailbox through Freedom first (Google is not authoritative for that mailbox).

To complete signup, repeat with a still-valid idToken and:

```json
{
  "idToken": "<Google ID token>",
  "profile": { "username": "Oleksandr", "displayName": "Олександр", "language": "uk", "acceptTerms": true }
}
```

201 returns the session. Existing username/display-name rules apply (2–10 letters;
username Latin only, display name also Ukrainian/Cyrillic and spaces). A unique-index
conflict returns 409 ACCOUNT_CONFLICT. Google-only users have NULL password and may
set one through the existing email password-reset flow.

### POST /api/auth/google/link

Requires `Authorization: Bearer <existing Freedom JWT>` plus:
`{ "idToken": "<Google ID token>", "password": "<current Freedom password>", "confirmLink": true }`.

Requires a verified Freedom account, matching email and password reauthentication.
Never auto-merges accounts, replaces a different linked Google identity, or changes
the existing user's username, password, media or chats. Unique Google subject prevents
linking one Google account to multiple users. Returns 200 on success.

## Verification

Unit tests use mock DB responses; they do not run a real database migration or real
Google account login. Before release test both new signup and existing-account linking
on a staging database and Google Play build; test duplicate concurrent signup, expired/
wrong-audience tokens, normal password login/reset and account deletion.

Token verification follows https://developers.google.com/identity/gsi/web/guides/verify-google-id-token:
Google library checks signature, issuer, audience and expiration; identity uses `sub`.
