# Secrets & environment variables — inventory

Source of truth for every secret / env var across the apps. **Real values live only in
`wrangler secret` / Cloudflare Secrets Store (prod) or `.dev.vars` (local dev, gitignored).**
Never commit real secrets (AGENTS.md §11.6).

## Local dev

Copy `.dev.vars.example` → `apps/<app>/.dev.vars` and fill in. `.dev.vars` is gitignored.

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

| Var            | Required | Description                                                                                               |
| -------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `MAPBOX_TOKEN` | yes      | Public Mapbox token for the café map picker (`/host/create`). Safe to expose client-side. Wrangler `var`. |

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

`DB` (D1), `EMAIL` (send_email), `IMAGES_BUCKET` (R2), KV namespaces, Queues, Vectorize index,
Analytics Engine dataset, `AI` (Workers AI). Resource names live in
[`libs/infra/resources.ts`](../libs/infra/src/resources.ts); bindings are added to each app's
`wrangler.jsonc` at provisioning.

## Per-app matrix

| App              | Auth | Turnstile   | SMS/Twilio | Mapbox | CF Access |
| ---------------- | ---- | ----------- | ---------- | ------ | --------- |
| apps/ui (public) | ✓    | ✓           | ✓          | ✓      | —         |
| apps/dashboard   | ✓    | ✓           | ✓          | —      | —         |
| apps/admin       | ✓    | ✓ (handler) | ✓          | —      | ✓         |
| apps/worker-jobs | —    | —           | —          | —      | —         |

FIREBASE_SERVICE_ACCOUNT=../firebase-service-account.json
FIREBASE_PROJECT_ID=founders-coffee
FIREBASE_VAPID_KEY=BCTgX9vVNLax8TlTkhWZHe6vuWRB8W4W6BLBzfUcGgGlWwEIzxN5vBeWVHtjb8AyCukoFrcXJG0ziNp9SMUUzig
