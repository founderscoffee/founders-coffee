# Secrets & environment variables — inventory

Source of truth for every secret / env var across the apps. **Real values live only in `wrangler secret` / Cloudflare Secrets Store (prod) or `.dev.vars` (local dev, gitignored).** Never commit real secrets (AGENTS.md §11.6).

## Local dev
Copy `.dev.vars.example` → `apps/<app>/.dev.vars` and fill in. `.dev.vars` is gitignored.

## Inventory

### Auth (`libs/auth`) — apps/ui, apps/dashboard, apps/admin
| Var | Required | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | yes | Better Auth session secret (≥32 chars). `wrangler secret put BETTER_AUTH_SECRET`. |
| `APP_URL` | yes | Public URL of the app (e.g. `http://localhost:3000` in dev). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google OAuth. Omit → provider disabled. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | GitHub OAuth. |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | optional | LinkedIn OAuth. |

### Turnstile (`libs/auth` handler) — apps/ui, apps/dashboard
| Var | Required | Description |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | optional | Server-side siteverify key. Omit / `TURNSTILE_DISABLED=true` in dev. |
| `TURNSTILE_DISABLED` | optional | `"true"` bypasses Turnstile in local dev. |
| `TURNSTILE_SITE_KEY` | public | Client-side site key (safe to expose in client bundles). |

### Cloudflare Access (apps/admin) — admin only
| Var | Required | Description |
|---|---|---|
| `CF_ACCESS_TEAM_DOMAIN` | yes | e.g. `founders.cloudflareaccess.com`. |
| `CF_ACCESS_AUD` | yes | Access Application Audience Tag. |
| `CF_ACCESS_DISABLED` | optional | `"true"` bypasses the JWT guard in LOCAL dev only. |

### Provisioned bindings (P0-019) — declared in wrangler.jsonc, not secrets
`DB` (D1), `IMAGES_BUCKET` (R2), KV namespaces, Queues, Vectorize index, Analytics Engine dataset. Resource names live in [`libs/infra/resources.ts`](../libs/infra/src/resources.ts); bindings are added to each app's `wrangler.jsonc` at provisioning.

## Per-app matrix
| App | Auth | Turnstile | CF Access |
|---|---|---|---|
| apps/ui (public) | ✓ | ✓ | — |
| apps/dashboard | ✓ | ✓ | — |
| apps/admin | ✓ | ✓ (handler) | ✓ |
