# Secrets & environment variables — inventory

Source of truth for every secret / env var across the apps. **Real values live only in
`wrangler secret` / Cloudflare Secrets Store (prod) or `.dev.vars` (local dev, gitignored).**
Never commit real secrets (AGENTS.md §11.6).

## Local dev

Copy `.dev.vars.example` → `apps/<app>/.dev.vars` and fill in. `.dev.vars` is gitignored.

## Deployed environments

Every secret is set **per environment**, and secrets survive redeploys, so they are set once at
provisioning rather than injected by CI:

```sh
cd apps/<app>
npx wrangler secret put <NAME> --env staging
npx wrangler secret put <NAME> --env production
```

`BETTER_AUTH_SECRET` **must differ between staging and production** — a shared value would make
staging session cookies valid in production.

Only non-sensitive configuration lives in `wrangler.jsonc` `vars` (`APP_URL`, `MAIL_FROM`), because
`vars` are committed and overwrite dashboard values on every deploy. `MAPBOX_TOKEN` and
`TURNSTILE_SITE_KEY` are public *to the browser* but are still kept as secrets so no token text lands
in the repository; both are read server-side and handed to the client by a server function.

## Inventory

### Auth (`libs/auth`) — apps/ui, apps/dashboard, apps/admin

| Var                                             | Required | Description                                                                                 |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                            | yes      | Better Auth session secret (≥32 chars). `wrangler secret put BETTER_AUTH_SECRET`.           |
| `APP_URL`                                       | yes      | Public URL of the app (e.g. `http://localhost:3000` in dev). Wrangler `var` (not a secret). |
| `MAIL_FROM`                                     | yes      | Sender email for OTP (wrangler `var`). Prod: verified Cloudflare sender.                    |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`     | optional | Google OAuth. Omit → provider disabled.                                                     |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`     | optional | GitHub OAuth.                                                                               |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | optional | LinkedIn OAuth.                                                                             |

### Turnstile (`libs/auth` handler) — apps/ui, apps/dashboard

| Var                    | Required | Description                                                                                             |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY` | optional | Server-side siteverify key. Omit / `TURNSTILE_DISABLED=true` in dev.                                    |
| `TURNSTILE_DISABLED`   | optional | `"true"` bypasses Turnstile in local dev.                                                               |
| `TURNSTILE_SITE_KEY`   | public   | Client-side site key (safe to expose in client bundles). Dev: `1x00000000000000000000AA` (always-pass). |

### SMS / Twilio Verify (`libs/auth` phoneNumber provider) — apps/ui, apps/dashboard, apps/admin

| Var         | Required | Description                                                         |
| ----------- | -------- | ------------------------------------------------------------------- |
| `TWILIO_SID` | optional | Twilio Verify Service SID (VA…). Omit → DevSmsProvider (console log). |
| `TWILIO_AID` | optional | Twilio Account SID (AC…).                                           |
| `TWILIO_SEC` | optional | Twilio Auth Token. Set via `wrangler secret`.                       |

### Mapbox — apps/ui

| Var            | Required | Description                                                                                                      |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `MAPBOX_TOKEN` | yes      | Mapbox token for the café map picker (`/host/create`), served to the client by `getMapboxToken`. Set as a secret. |

### Firebase web push (`libs/server-fns/config.ts`) — apps/ui

Read by `getFirebaseConfig` and handed to the PWA push client. All five are designed to be public,
but are set as secrets so they are not committed. If `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID` or
`FIREBASE_VAPID_KEY` is missing, `getFirebaseConfig` returns `null` and the client skips push.

| Var                            | Required | Description                                     |
| ------------------------------ | -------- | ----------------------------------------------- |
| `FIREBASE_API_KEY`             | yes      | Firebase web app API key.                       |
| `FIREBASE_PROJECT_ID`          | yes      | Firebase project id.                            |
| `FIREBASE_VAPID_KEY`           | yes      | VAPID application-server key for web push.      |
| `FIREBASE_MESSAGING_SENDER_ID` | optional | Falls back to an empty string.                  |
| `FIREBASE_APP_ID`              | optional | Falls back to an empty string.                  |

### Notifications — apps/worker-jobs

Consumed by the cron sweep. Each provider degrades to a dev variant when its vars are absent:
no Twilio vars → `DevNotificationSmsProvider` (logs); no Firebase vars → push disabled.

| Var                         | Required | Description                                                     |
| --------------------------- | -------- | --------------------------------------------------------------- |
| `TWILIO_AID`                | optional | Twilio Account SID (AC…) for Programmable SMS.                  |
| `TWILIO_SEC`                | optional | Twilio Auth Token.                                              |
| `TWILIO_SMS_FROM`           | optional | Sending number or messaging-service SID.                        |
| `FIREBASE_PROJECT_ID`       | optional | FCM project id.                                                 |
| `FIREBASE_SERVICE_ACCOUNT`  | optional | Full service-account JSON. Set with `wrangler secret put … < file`. |

### Geo-routing — apps/ui (dev only)

| Var       | Required | Description                                                                                                                              |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DEV_GEO` | optional | Dev override for CF-IPCountry (Miniflare doesn't set it). Set to `DZ`/`EG`/`SA` to test geo-redirect. Prod: the CF edge sets the header. |

### Cloudflare Access (apps/admin) — admin only

| Var                     | Required | Description                                        |
| ----------------------- | -------- | -------------------------------------------------- |
| `CF_ACCESS_TEAM_DOMAIN` | yes      | e.g. `founders.coffee.cloudflareaccess.com`.       |
| `CF_ACCESS_AUD`         | yes      | Access Application Audience Tag.                   |
| `CF_ACCESS_DISABLED`    | optional | `"true"` bypasses the JWT guard in LOCAL dev only. |

### Provisioned bindings (P0-019) — declared in wrangler.jsonc, not secrets

`DB` (D1), `EMAIL` (send_email), `AI` (Workers AI), `VECTOR` (Vectorize), and the `EVENT_LIVE` /
`RATE_LIMITER` Durable Objects. Resource base names live in
[`libs/infra/resources.ts`](../libs/infra/src/resources.ts) and are suffixed per environment. R2, KV,
Queues and the Analytics Engine dataset are registered but not yet bound by any app — see
[`provisioning.md`](provisioning.md).

## Per-app matrix

| App              | Auth | Turnstile   | SMS/Twilio | Mapbox | Firebase | CF Access |
| ---------------- | ---- | ----------- | ---------- | ------ | -------- | --------- |
| apps/ui (public) | ✓    | ✓           | ✓          | ✓      | ✓ (web)  | —         |
| apps/dashboard   | ✓    | ✓           | ✓          | —      | —        | —         |
| apps/admin       | ✓    | ✓ (handler) | ✓          | —      | —        | ✓         |
| apps/worker-jobs | —    | —           | ✓          | —      | ✓ (FCM)  | —         |
