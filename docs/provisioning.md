# Cloudflare provisioning — staging + production

Implements **P0-019**. Runbook for standing up both deploy environments. Resource base names come
from [`libs/infra/src/resources.ts`](../libs/infra/src/resources.ts); every account-scoped resource is
created once per environment with an `-staging` / `-production` suffix.

## Status

Steps 1–5 are **done** for both environments and staging is serving on
`https://staging.founders.coffee`. Step 6 (Email Sending DNS, Cloudflare Access for `apps/admin`,
the `www` redirect) is still outstanding, and the third-party secrets below are unset — each degrades
a feature rather than breaking the deploy, except where noted.

| Unset secret | Consequence |
| ------------ | ----------- |
| `MAPBOX_TOKEN` | The café map picker on `/host/create` cannot load. |
| `TURNSTILE_SECRET_KEY` | No bot protection on signup / login / RSVP (AGENTS.md §10 requires it). |
| `TWILIO_SID` / `TWILIO_AID` / `TWILIO_SEC` | Phone-OTP silently falls back to `DevSmsProvider`, which **logs the OTP instead of sending it** — anyone able to read Worker logs can log in as any phone number. Set these before exposing signup. |
| `FIREBASE_*` | Web push disabled; `getFirebaseConfig` returns `null`. |
| `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` | `apps/admin` rejects every request until Access is configured. |

Email Sending is the other hard gap: until the SPF/DKIM/DMARC records exist, the `EMAIL` binding
cannot send, so email-OTP login and RSVP notifications fail in both deployed environments.

## What each environment needs

| Resource | Staging | Production | Provisioned by |
| -------- | ------- | ---------- | -------------- |
| D1 database | `founders-coffee-db-staging` | `founders-coffee-db-production` | wrangler |
| Vectorize index | `founders-coffee-embeddings-staging` | `founders-coffee-embeddings-production` | wrangler |
| Workers AI | binding only | binding only | nothing to create |
| Durable Objects | `EventLiveDO`, `RateLimiterDO` | same | created on first deploy |
| Custom domains | `staging.founders.coffee`, `app-staging.`, `admin-staging.` | `founders.coffee`, `app.`, `admin.` | `wrangler deploy` (zone must exist) |
| Email Sending | shared | shared | **dashboard + DNS (manual)** |
| Access (admin) | `admin-staging.founders.coffee` | `admin.founders.coffee` | **dashboard (manual)** |
| Turnstile | test keys or real widget | real widget | dashboard |

**Not provisioned yet** — no app declares these bindings, so creating them now would be unused
infrastructure: R2 (`founders-coffee-images`), KV (`founders-coffee-flags`), Queues, Analytics Engine.
Notifications currently flow through the D1 `scheduled_notifications` table plus the one-minute cron
in `apps/worker-jobs`, not through Queues.

## API token scopes

Create a custom token at **My Profile → API Tokens → Create Custom Token**:

- **Account** — `Workers Scripts: Edit`, `D1: Edit`, `Vectorize: Edit`, `Workers AI: Edit`,
  `Account Settings: Read`
- **Account** — `Turnstile: Edit` (only to create widgets via API)
- **Zone** — `Workers Routes: Edit`, `DNS: Edit`, `Zone: Read` (required for the custom domains)

Export it before running anything below:

```sh
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
npx wrangler whoami          # confirms the token resolves to the right account
```

## 1. Create the databases and indexes

```sh
npx wrangler d1 create founders-coffee-db-staging
npx wrangler d1 create founders-coffee-db-production

# 1024 dimensions / cosine — fixed by the bge-m3 embedding model (see docs/ai.md).
npx wrangler vectorize create founders-coffee-embeddings-staging --dimensions 1024 --metric cosine
npx wrangler vectorize create founders-coffee-embeddings-production --dimensions 1024 --metric cosine
```

## 2. Record the D1 IDs in the wrangler configs

`wrangler d1 create` prints a `database_id`. It is an account-scoped identifier, not a credential —
it is useless without the API token — so it is committed in the wrangler configs.

| Environment | Database ID | Region |
| ----------- | ----------- | ------ |
| staging | `cbbba018-a4e3-491a-9a02-7995aa45315b` | WEUR |
| production | `7685fda1-7bc0-4907-a37a-a77e8daa5ecb` | WEUR |

`--location weur` puts the primary near the Maghreb/EU user base (AGENTS.md §11.5).

The top-level `LOCAL_DEV_ONLY` value is deliberate: Miniflare keys local D1 off `database_name`, and
the top-level config is never deployed.

> **Always pass `--env` to `wrangler d1` commands.** The top-level config declares
> `database_name: founders-coffee-db-staging` with the `LOCAL_DEV_ONLY` id, so a bare
> `wrangler d1 execute founders-coffee-db-staging --remote` resolves to that placeholder and fails
> against `/d1/database/LOCAL_DEV_ONLY/`. Production has no top-level entry, so it silently falls
> back to an API lookup by name and appears to work — the inconsistency is the trap.

## 3. Apply migrations

```sh
npm run migrate:staging
npm run migrate:production
```

## 4. Seed the markets

The market rows (DZ, EG, SA — all `active`) are defined in
[`libs/db/src/seed.ts`](../libs/db/src/seed.ts). Cities are **not** in D1; the 6,518-city datasets are
server-side TS files in `libs/domain/src/geo/data/`.

`seed()` takes a Drizzle `Db` and today has no caller outside the test suite, so a deployed database
must be seeded with the equivalent idempotent SQL. Without it every market lookup misses and the
site cannot render:

```sh
cd apps/worker-jobs
npx wrangler d1 execute founders-coffee-db-staging --remote --env staging \
  --command "INSERT INTO markets (code, name, name_ar, slug, default_locale, default_currency, timezone, direction, state, feature_flags) VALUES ('DZ','Algeria','الجزائر','algeria','ar','DZD','Africa/Algiers','rtl','active','{\"events\":true,\"hackathons\":false,\"payments\":false,\"recruiting\":false}') ON CONFLICT (code) DO NOTHING"
```

Repeat per market and per environment. Folding this into a migration (so every environment,
including a fresh local one, self-seeds through the existing CI migration step) is the obvious
follow-up — it would also remove the second source of truth this command creates.

## 5. Set secrets per environment

Secrets are set once and survive redeploys — they are not stored in GitHub. Full inventory in
[`secrets.md`](secrets.md).

```sh
cd apps/ui
npx wrangler secret put BETTER_AUTH_SECRET --env staging      # openssl rand -base64 48
npx wrangler secret put BETTER_AUTH_SECRET --env production   # a DIFFERENT value
```

Use a distinct `BETTER_AUTH_SECRET` per environment: sharing it would make staging session cookies
valid in production.

## 6. Manual dashboard steps

These have no wrangler equivalent.

**Email Sending** — Dashboard → Email → enable the Email Service for `founders.coffee` and add the
generated SPF/DKIM/DMARC records. Until this is done the `EMAIL` binding cannot send, so email-OTP
login and RSVP email notifications fail in the deployed environments. Phone-OTP via Twilio is
unaffected.

**Cloudflare Access for `apps/admin`** — Zero Trust → Access → Applications, one application per
environment (`admin.founders.coffee`, `admin-staging.founders.coffee`) with an email-OTP or
allow-list policy. Record `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` and set them as secrets on the
admin Worker. Access alone is not sufficient — the Worker verifies the JWT itself and keeps
`workers_dev: false` in every environment (AGENTS.md §10).

**`www` redirect** — production binds the apex `founders.coffee` only. Add a Cloudflare Redirect Rule
for `www` rather than a second custom domain.

## 7. Verify

```sh
cd apps/worker-jobs
npx wrangler d1 execute founders-coffee-db-staging --remote --env staging \
  --command "select code, state from markets"
npx wrangler vectorize get founders-coffee-embeddings-staging
npx wrangler deploy --dry-run --env production
```

A plain `curl` against a deployed app returns **403 Forbidden**: the CSRF middleware in
`apps/ui/src/start.ts` accepts only `Sec-Fetch-Site: none` or `same-origin`, and curl sends no such
header. Add `-H 'Sec-Fetch-Site: none'` to smoke-test from the shell. The first response is then a
`307` to the geo-resolved market (`/algeria` from an Algerian edge), not a `200`.

## Plan notes

Two decisions in [`p0-019-020-021-plan.md`](p0-019-020-021-plan.md) were superseded: CI is GitHub
Actions rather than GitLab (the repository moved to GitHub), and there are two environments rather
than a single free-tier `test` environment.
