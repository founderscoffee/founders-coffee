# Secrets & environment variables — inventory

This inventory includes dormant foundations, but only credentials consumed by the
[community-building release](./release-strategy.md) are current launch requirements. Future sponsor,
challenge, talent, payment, AI/search, and expansion secrets become required only after that phase is
explicitly approved and enabled.

Source of truth for every secret / env var across the apps. **Real values live only in
`wrangler secret` / Cloudflare Secrets Store (prod) or `.dev.vars` (local dev, gitignored).**
Never commit real secrets (AGENTS.md §10).

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
`TURNSTILE_SITE_KEY` are public _to the browser_ but are still kept as secrets so no token text lands
in the repository; both are read server-side and handed to the client by a server function.

## Inventory

### Auth (`libs/auth`) — apps/ui

| Var                                         | Required | Description                                                                                 |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | yes      | Better Auth session secret (≥32 chars). `wrangler secret put BETTER_AUTH_SECRET`.           |
| `APP_URL`                                   | yes      | Public URL of the app (e.g. `http://localhost:3000` in dev). Wrangler `var` (not a secret). |
| `MAIL_FROM`                                 | yes      | Sender email for OTP (wrangler `var`). Prod: verified Cloudflare sender.                    |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google OAuth. Omit → provider disabled.                                                     |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | GitHub OAuth.                                                                               |

### Turnstile and event-create WAF evidence — apps/ui

| Var                           | Required | Description                                                                                                                      |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENVIRONMENT`             | yes      | Committed Worker var: `development`, `staging`, or `production`; prevents local security bypasses from working when deployed.    |
| `TURNSTILE_SECRET_KEY`        | yes      | Server-side siteverify key. **Omitting it denies the gated endpoints**, it does not disable the check.                           |
| `TURNSTILE_DISABLED`          | local    | `"true"` bypasses Turnstile only when `APP_ENVIRONMENT=development`; it fails closed in staging and production.                  |
| `TURNSTILE_SITE_KEY`          | public   | Client-side site key (safe to expose in client bundles). Local automated tests may use `1x00000000000000000000AA` (always-pass). |
| `EVENT_CREATE_WAF_CONFIGURED` | yes      | Set to `true` only after the shared zone WAF rule is active and recorded; absence intentionally blocks deployed creation.        |

`TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` must be set **together**. `getPublicAuthConfig`
returns `turnstileSiteKey: null` when the site key is absent, so the widget never renders, the client
sends no token, and siteverify rejects every request — a secret key without a site key locks users
out of login entirely.

Authentication verification is Better Auth's official `captcha` plugin (`provider: 'cloudflare-turnstile'`),
registered in `createAuth` when the secret key is present. It reads the token from the
`x-captcha-response` header, calls siteverify under a 10-second deadline, and rejects a missing or
invalid token. The gated paths are listed once in
[`libs/auth/src/captcha.ts`](../libs/auth/src/captcha.ts) — only the endpoints that _send_ an SMS or
an email.

The gate fails **closed**. `TURNSTILE_DISABLED=true` is the only bypass; when the secret key is
merely absent the plugin is not registered at all, so `createAuthHandler` refuses the gated
endpoints with a 503. These endpoints spend money — an unprotected `/phone-number/send-otp` is an
open SMS-pumping relay against the Twilio account — so a forgotten secret must be a visible outage,
not a silent hole (AGENTS.md §10). The dev-only `1x00000000000000000000AA` site key and
`TURNSTILE_DISABLED` must never be set on a deployed environment.
Deployed staging has its own widget, `founders-coffee-staging` (`0x4AAAAAAEmLQr5Hfn0DrNUo`),
restricted to `staging.founders.coffee`. Cloudflare's dummy test keys answer `siteverify` with
hostname `example.com` and no `action` at all, so they satisfy sign-in but never a flow that pins
either — do not reach for them to unblock a test.

Event creation carries no bot challenge. Turnstile would not issue a token to any automated
browser in any widget mode, which left the release gate unable to exercise the create path at all,
and the product owner chose the coverage over the challenge on 2026-09-03. Creation is still bounded
by the authenticated `event:create` permission, the five-per-ten-minute `create_event` Durable
Object bucket, and the account-side WAF rule; it is no longer proof-of-humanity gated, so an
authenticated account can automate creation up to those limits.

Sign-in and the waitlist keep the challenge. The waitlist uses the shared provider in
`libs/server-fns/src/turnstile`, which validates the `join_waitlist` action and environment
hostname, uses an idempotency key, and forwards only the Cloudflare-set `CF-Connecting-IP`.

A missing secret, a deployed bypass, or a missing `EVENT_CREATE_WAF_CONFIGURED=true` marker still
fails event creation closed before Mapbox or D1 creation work. The marker
is evidence, not the WAF itself: set it only after the account rule is verified according to
[`provisioning.md`](./provisioning.md) and recorded in [`deployment-evidence.md`](./deployment-evidence.md).
The shared Free-plan rule was activated and recorded on 2026-09-02, and the marker was uploaded to
both staging and production Workers. The marker remains an evidence gate rather than a substitute
for WAF enforcement; remove it if the shared rule is disabled or no longer matches these paths.

Better Auth resolves the `remoteip` it forwards to siteverify, and the key for its D1-backed rate
limiter, from `advanced.ipAddress.ipAddressHeaders`. That is pinned to `cf-connecting-ip` rather than
the library default `x-forwarded-for`, because on Workers only the former is set by the edge and
cannot be forged by the client (AGENTS.md §11.5).

### SMS / Twilio Verify (`libs/auth` phoneNumber provider) — apps/ui

| Var          | Required                    | Description                                                                            |
| ------------ | --------------------------- | -------------------------------------------------------------------------------------- |
| `TWILIO_SID` | when phone login is enabled | Twilio Verify Service SID (VA…). The current UI does not expose phone login.           |
| `TWILIO_AID` | when phone login is enabled | Twilio Account SID (AC…). Notification delivery has its own current requirement below. |
| `TWILIO_SEC` | when phone login is enabled | Twilio Auth Token. Notification delivery has its own current requirement below.        |

`DevSmsProvider` is for local development only. Even while phone login remains unexposed, deployed
phone-OTP endpoints must fail closed when credentials are absent; logging an OTP in a deployed
Worker is not an acceptable fallback. Real Verify credentials become a product requirement only if
the phone-login UI is explicitly enabled.

### Mapbox — apps/ui

| Var            | Required | Description                                                                                                                |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `MAPBOX_TOKEN` | yes      | Mapbox token for the café map picker (`/{market}/host/create`), served to the client by `getMapboxToken`. Set as a secret. |

### Firebase web push (`libs/server-fns/config.ts`) — apps/ui

Read by `getFirebaseConfig` and handed to the PWA push client. All five are designed to be public,
but are set as secrets so they are not committed. If `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID` or
`FIREBASE_VAPID_KEY` is missing, `getFirebaseConfig` returns `null` and the client skips push. Since
PWA web push is the primary event-notification channel, missing production configuration is a visible
degradation and must be caught by release checks.

| Var                            | Required | Description                                |
| ------------------------------ | -------- | ------------------------------------------ |
| `FIREBASE_API_KEY`             | yes      | Firebase web app API key.                  |
| `FIREBASE_PROJECT_ID`          | yes      | Firebase project id.                       |
| `FIREBASE_VAPID_KEY`           | yes      | VAPID application-server key for web push. |
| `FIREBASE_MESSAGING_SENDER_ID` | optional | Falls back to an empty string.             |
| `FIREBASE_APP_ID`              | optional | Falls back to an empty string.             |

### Notifications — apps/worker-jobs

Consumed by the delivery worker. PWA web push is primary and Programmable SMS is the fallback.
Development logging variants are local-only; a deployed worker must never silently replace a real
provider with a logger when credentials are absent.

| Var                        | Required   | Description                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MAIL_FROM`                | yes        | Sender email for notification mail (wrangler `var`). Same address as apps/ui.                                                                                                                                                                                                                                                                          |
| `TWILIO_AID`               | production | Twilio Account SID (AC…) for Programmable SMS. Must be the **live** SID, not the test one — test credentials return `20008` on every call.                                                                                                                                                                                                             |
| `TWILIO_SEC`               | production | Twilio Auth Token (live, matching `TWILIO_AID`).                                                                                                                                                                                                                                                                                                       |
| `TWILIO_SMS_FROM`          | production | Alphanumeric sender ID, sent as Twilio's `From` (wrangler `var`, not a secret). DZ supports dynamic alpha senders with no pre-registration, but Mobilis rejects generic IDs, so it must read as the brand. A messaging-service SID (`MG…`) will **not** work — that needs a separate `MessagingServiceSid` parameter. Numeric senders fail on Mobilis. |
| `FIREBASE_PROJECT_ID`      | production | FCM project id.                                                                                                                                                                                                                                                                                                                                        |
| `FIREBASE_SERVICE_ACCOUNT` | production | Full service-account JSON. Set with `wrangler secret put … < file`.                                                                                                                                                                                                                                                                                    |

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

### Cloudflare bindings — declared in wrangler.jsonc, not secrets

`DB` (D1), `EMAIL` (send_email), `AI` (Workers AI), `VECTOR` (Vectorize), and the `EVENT_LIVE` /
`RATE_LIMITER` Durable Objects. Resource base names live in
[`libs/infra/resources.ts`](../libs/infra/src/resources.ts) and are suffixed per environment. Queue,
Analytics Engine, R2, and KV requirements vary by feature; declaration in source control does not
prove account-side provisioning. The last verified state is recorded in
[`provisioning.md`](provisioning.md).

## Per-app matrix

| App                | Current or required integration                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/ui`          | Better Auth, Turnstile, email OTP, Mapbox, and Firebase public web configuration; Twilio Verify remains dormant/fail-closed until phone login is enabled |
| `apps/dashboard`   | Sponsor-only shell today; its future authenticated sponsor flows require Better Auth and the applicable protection secrets                               |
| `apps/admin`       | Cloudflare Access guard today; CO-04 must add an admin-origin Better Auth session and require its verified email to match the Access identity            |
| `apps/worker-jobs` | Firebase service account for primary push, Twilio Programmable SMS for fallback, and email only for explicitly email-based jobs                          |

## `apps/admin` — Cloudflare Access and sign-in

| Secret                  | Required | Notes                                                                                                                                                                                                                           |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CF_ACCESS_TEAM_DOMAIN` | yes      | `<team>.cloudflareaccess.com`, no scheme. Same in both environments.                                                                                                                                                            |
| `CF_ACCESS_AUD`         | yes      | The Application Audience tag of the Access application **for that hostname**. Staging and production have different applications and therefore different tags; sharing one would let a staging token verify against production. |
| `TURNSTILE_SECRET_KEY`  | **yes**  | Without it `createAuthHandler` answers `503 captcha_unconfigured` on the sign-in endpoint and no operator can log in. `TURNSTILE_DISABLED=true` is a local-development bypass only.                                             |
| `TURNSTILE_SITE_KEY`    | **yes**  | Read by the login route to render the widget. Absent, the page sends no token and the server refuses. The Turnstile widget must list the admin hostnames.                                                                       |
| `BETTER_AUTH_SECRET`    | yes      | Already set.                                                                                                                                                                                                                    |

The admin Worker also needs its `DB` and `send_email` bindings, both declared in
`apps/admin/wrangler.jsonc`. Email OTP is the only sign-in method; without the mail binding a code is
requested and never delivered, and Better Auth answers 200 either way.
