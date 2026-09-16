# Cloudflare provisioning — staging + production

This runbook distinguishes resources required for the
[community-building release](./release-strategy.md) from dormant future foundations. A declared
future binding is not a launch blocker unless a current community workflow consumes it.

Implements **P0-019**. Runbook for standing up both deploy environments. Resource base names come
from [`libs/infra/src/resources.ts`](../libs/infra/src/resources.ts); every account-scoped resource is
created once per environment with an `-staging` / `-production` suffix.

## Status

**Last checked: 2026-09-14.** Repository configuration and deployment evidence cover staging and
production D1 IDs, Vectorize bindings, Worker routes, migrations, notification queues and Durable
Objects. Cloudflare dashboard state and secret presence are still environment facts; the dated
deployment records in [deployment-evidence.md](./deployment-evidence.md) are the current proof.

A bounded check from the current engineering environment is not a substitute for the account-side
records below. Treat a newly changed deployment as **unverified** until §7 succeeds from a normal
network and the Cloudflare dashboard confirms the routes; the dated staging/production releases in
deployment evidence are the current verification baseline.

A dedicated API token activated the shared EC-06 WAF rule on 2026-09-02. The zone is on the Free
Website plan, so its single rate-limiting-rule slot protects both `/api/auth/` and `/_serverFn/` for
every hostname. The rule and both Worker evidence markers are active; staging and production burst
probes are recorded in [`deployment-evidence.md`](./deployment-evidence.md).

| Unset secret                              | Consequence                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `MAPBOX_TOKEN`                            | The café map picker on `/{market}/host/create` cannot load.                                                                                |
| `TURNSTILE_SECRET_KEY`                    | Gated auth endpoints fail closed with `503`; event/RSVP coverage still requires the P1-018 audit.                                          |
| `EVENT_CREATE_WAF_CONFIGURED`             | Event creation fails closed before Siteverify, Mapbox, or D1 work in staging and production.                                               |
| `TWILIO_SID`                              | Phone login remains disabled without a Verify Service SID. Deployed phone-OTP endpoints must fail closed rather than use `DevSmsProvider`. |
| `TWILIO_AID` / `TWILIO_SEC`               | Same-day cancellation SMS cannot send, and deployed phone-OTP endpoints must remain fail-closed.                                           |
| `TWILIO_SMS_FROM`                         | Same-day cancellation SMS cannot send with the configured notification provider.                                                           |
| `FIREBASE_*`                              | Web push disabled; `getFirebaseConfig` returns `null`.                                                                                     |
| `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` | `apps/admin` rejects every request until Access is configured.                                                                             |

Email Sending is another hard gap: until the required sender and DNS records exist, the `EMAIL`
binding cannot send, so email-OTP login and any explicitly email-based workflow fail in deployed
environments.

## What each environment needs

| Resource        | Staging                                                     | Production                              | Provisioned by                      |
| --------------- | ----------------------------------------------------------- | --------------------------------------- | ----------------------------------- |
| D1 database     | `founders-coffee-db-staging`                                | `founders-coffee-db-production`         | wrangler                            |
| Vectorize index | `founders-coffee-embeddings-staging`                        | `founders-coffee-embeddings-production` | wrangler                            |
| Workers AI      | binding only                                                | binding only                            | nothing to create                   |
| Durable Objects | `EventLiveDO`, `RateLimiterDO`, `NotificationScheduleDO`    | same                                    | created/bound by deployed Workers   |
| Custom domains  | `staging.founders.coffee`, `app-staging.`, `admin-staging.` | `founders.coffee`, `app.`, `admin.`     | `wrangler deploy` (zone must exist) |
| Email Sending   | shared                                                      | shared                                  | **dashboard + DNS (manual)**        |
| Access (admin)  | `admin-staging.founders.coffee`                             | `admin.founders.coffee`                 | **dashboard (manual)**              |
| Turnstile       | real widget restricted to `staging.founders.coffee`         | real widget                             | dashboard                           |
| WAF rate limit  | shared `/api/auth/` + `/_serverFn/` edge-volume rule        | same zone-wide rule                     | dashboard / Rulesets API            |

The Notifications, embeddings and reconcile queues plus a dead-letter queue were created per
environment on 2026-09-04 and their consumers bound in `apps/worker-jobs/wrangler.jsonc`; see
[`worker-jobs.md`](./worker-jobs.md) for the names and routing rule. CO-02's notification producer
and `NotificationScheduleDO` binding are deployed in both environments. Embeddings and reconcile
producers remain intentionally dormant.

**Declared but not yet verified/provisioned:** KV (`founders-coffee-flags`) and the existing
AI/Vectorize foundation. The private R2 buckets `founders-coffee-assets-{dev,staging,production}`
were created for PF-06 on 2026-09-09 and are currently empty; the Images binding is runtime
configuration rather than a separately provisioned storage subscription. Analytics Engine is bound
to the public Worker and its first `events_created` write was verified during EC-10. KV and the
AI/Vectorize foundation are not launch blockers unless a current community workflow explicitly
requires them. Notifications flow through per-event Durable Object alarms into the Notifications
Queue, with a fifteen-minute recovery sweep behind them, as of CO-02 on 2026-09-10. The Durable
Object namespace and worker-jobs producer binding are deployed in both environments. Worker-jobs
must still be deployed before `apps/ui`, which binds the class across scripts.

Current launch provisioning requires D1, event/rate-limit/notification Durable Objects, custom
domains, Email Sending for email OTP and notification fallback, Turnstile, Mapbox, FCM web push,
private R2 plus Images bindings for profile photos, Twilio Programmable SMS for same-day cancellation
disruption, the Notifications Queue/DLQ, Analytics Engine, and Access for the essential admin
surface. Workers AI, Vectorize, future sponsor/media storage, sponsor/dashboard integrations, and
payment infrastructure do not delay the community release.

## API token scopes

Create a custom token at **My Profile → API Tokens → Create Custom Token**:

- **Account** — `Workers Scripts: Edit`, `D1: Edit`, `Vectorize: Edit`, `Workers AI: Edit`,
  `Account Settings: Read`
- **Account** — `Turnstile: Edit` (only to create widgets via API)
- **Zone** — `Workers Routes: Edit`, `DNS: Edit`, `Zone: Read` (required for the custom domains)
- **Zone** — `Zone WAF: Edit` or `Firewall Services: Edit` (required for the EC-06 rate-limiting rules)

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

# 1024 dimensions / cosine — fixed by the bge-m3 embedding model.
npx wrangler vectorize create founders-coffee-embeddings-staging --dimensions 1024 --metric cosine
npx wrangler vectorize create founders-coffee-embeddings-production --dimensions 1024 --metric cosine
```

## 2. Record the D1 IDs in the wrangler configs

`wrangler d1 create` prints a `database_id`. It is an account-scoped identifier, not a credential —
it is useless without the API token — so it is committed in the wrangler configs.

| Environment | Database ID                            | Region |
| ----------- | -------------------------------------- | ------ |
| staging     | `cbbba018-a4e3-491a-9a02-7995aa45315b` | WEUR   |
| production  | `7685fda1-7bc0-4907-a37a-a77e8daa5ecb` | WEUR   |

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

Before applying a remote migration in a deployment, capture the release state from the repository
root so the matching Worker versions and D1 bookmark are retained together:

```sh
mkdir -p /tmp/founders-coffee-rollback
node tools/deploy/release-state.mjs capture \
  --environment staging \
  --output /tmp/founders-coffee-rollback/staging.json
```

The deploy workflow performs this capture automatically and uploads it as a GitHub Actions
artifact. The artifact is the recovery record for that release; do not replace it with a bookmark
captured after the migration. D1 Time Travel retention is plan-dependent, so copy production
artifacts to the approved operational archive before the retention window expires.

If a release is incompatible, use the manual **Rollback** workflow described in
[`ci.md`](ci.md#githubworkflowsrollbackyml) to roll back the four Worker versions. Do not restore
D1 as part of that workflow. If corruption or an irreversible data change requires reversal, stop
deployments, obtain incident approval, and run the Cloudflare Time Travel restore manually during a
maintenance window. This is an overwrite operation; the restore response's previous bookmark is
the only safe undo point and must be recorded in the incident log without publishing it in chat or
artifacts.

To exercise the complete staging path with one guarded command, run `npm run rollback:staging` from
the repository root. It deploys the current `develop` revision, rolls back the captured Worker
versions, verifies the SEO smoke contract, and redeploys the latest code without changing D1.

## 4. Seed the markets

The configured market rows are DZ, EG, and SA, all `active`. MA and AE are not configured. The
canonical rows are defined in [`libs/db/src/seed.ts`](../libs/db/src/seed.ts), and migration
`0029_activate_launch_markets` activates existing DZ/EG/SA rows and removes legacy MA/AE rows.
Cities are **not** in D1; the 6,518-city datasets are server-side TS files in
`libs/domain/src/geo/data/`.

Apply migrations first, then seed the three rows idempotently in each environment. This preserves
the test/local convention where migrations create schema and `seed()` supplies market data:

```sh
npm run migrate:staging
npm run migrate:production
```

For a deployed database, run the equivalent `seed()` values for DZ, EG, and SA (all with
`state='active'`) after the migration. Do not recreate MA or AE rows. The migration does not
cascade dependent historical records; if a legacy MA/AE row is referenced, stop and review that
data before applying the deletion.

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
required sender and DNS records. Until this is done the `EMAIL` binding cannot send, so email-OTP
login and any explicitly email-based workflow fail in the deployed environments. Phone-OTP via
Twilio is unaffected.

**Cloudflare Access for `apps/admin`** — Zero Trust → Access → Applications, one application per
environment (`admin.founders.coffee`, `admin-staging.founders.coffee`) with an email-OTP or
allow-list policy. Record `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` and set them as secrets on the
admin Worker. Access alone is not sufficient — the Worker verifies the JWT itself and keeps
`workers_dev: false` in every environment (AGENTS.md §10). CO-04 also mounts Better Auth on the admin
origin, binds the shared environment D1 and Email Sending resources, and requires the verified Access
email to match the verified Better Auth email on every privileged request. The staging Access policy
must include only the dedicated staging-admin identity used by CO-11; the two product identities and
their roles are recorded and revoked together after the rehearsal.

**Shared Free-plan WAF rate limit** — Security → Security rules → Rate limiting rules. Apply the
exact definition in `libs/infra/cloudflare/waf/free-shared-mutation-rate-limit-rule.json`. The one
zone-wide rule covers `/api/auth/` and the stable TanStack `/_serverFn/` path across staging and
production, counts by edge colo and source IP, allows 20 requests per 10 seconds, and blocks for 10
seconds. These are the Free plan's supported characteristics, period, timeout, and path-only match.
Keep the rule at the end of the `http_ratelimit` phase as Cloudflare requires. Record the shared rule
ID before enabling each Worker marker:

```sh
cd apps/ui
npx wrangler secret put EVENT_CREATE_WAF_CONFIGURED --env staging
npx wrangler secret put EVENT_CREATE_WAF_CONFIGURED --env production
```

Enter `true` only after verification. For the independent staging check, temporarily narrow the rule
to the unique nonexistent path `/_serverFn/ec06-waf-free-plan-probe` and set five requests per 10
seconds. Issue six requests from one test IP, confirm the sixth is blocked by WAF, and restore the
committed shared expression and 20-request threshold immediately. Then separately exhaust the
five-per-ten-minute `create_event` Durable Object bucket from an authenticated session. The WAF
test must not create events; the DO test may use disposable staging events removed through the
normal operational path. Record timestamps, the shared rule ID, response statuses, and restored
configuration. Run the production behavioral check only after the apex hostname resolves, using the
same unique-path procedure without changing the live shared expression longer than the test window.

**Production SEO smoke exception** — Security → Security rules → Custom rules. Apply the exact
definition in `libs/infra/cloudflare/waf/seo-smoke-skip-rule.json` as the zone entrypoint rule in
the `http_request_firewall_custom` phase. It covers the four public discovery files and GET public
locale paths carrying the private `x-founders-coffee-seo-smoke: 1` header. Its skip targets are the
managed firewall and rate-limit phases plus the Browser Integrity Check and security-level
products. Bot Fight Mode is disabled for production because the Free plan applies it across the
whole zone and cannot selectively bypass the monitor. This lets the GitHub-hosted deploy gate read
the production custom domain while WAF rules, rate limits, Turnstile, and Browser Integrity Check
remain active. Keep Browser Integrity Check `on` and security level `medium`; the rule ID currently
in the zone is `249f3894757b4252923bbf2fdf9f07c6`.

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

## Repository conventions

CI uses GitHub Actions, and the deployed environments are staging and production. Historical
provisioning plans that described GitLab or a single free-tier test environment have been deleted.
