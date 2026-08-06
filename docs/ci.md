# CI/CD — GitHub Actions → Cloudflare Workers

Implements **P0-020**. Two workflows, two Cloudflare environments, four Workers per environment.

## Branch → environment mapping

| Trigger | Cloudflare environment | Gate |
| ------- | ---------------------- | ---- |
| push to `develop` | `staging` | none — deploys automatically |
| manual run from `main` | `production` | the manual run **is** the gate |
| push to `main` | none | runs `ci.yml` only |

### Why production is manual rather than reviewer-approved

The intended design was a push to `main` deploying production behind a required-reviewer rule on the
`production` GitHub Environment. That protection rule needs **GitHub Pro/Team on a private
repository**; on the current plan the API rejects it with:

> Failed to create the environment protection rule. Please ensure the billing plan supports the
> required reviewers protection rule.

So production is deployed by explicitly running the **Deploy** workflow and selecting `production`,
which is an equivalent human gate. The `resolve` job refuses to deploy production from any ref other
than `main`, so a manual run against a feature branch cannot reach it.

To switch to the original design after upgrading the plan: add `main` back to the `push.branches`
list in `deploy.yml`, restore `production` to the branch-resolution logic, and add the reviewer rule:

```sh
gh api -X PUT repos/<owner>/<repo>/environments/production \
  -f 'reviewers[][type]=User' -F "reviewers[][id]=$(gh api user --jq .id)"
```

Both `staging` and `production` GitHub Environments already exist, so environment-scoped secrets work
either way.

## Workflows

### `.github/workflows/ci.yml`

Runs on every pull request, and is called by `deploy.yml` as a gate. Needs **no** Cloudflare
credentials — the integration tests run against Miniflare with real local D1/Queues/Email bindings
(AGENTS.md §12), not the live account.

1. `npm ci`
2. `nx sync:check` — asserts the tsconfig project references are committed. `nx.json` sets
   `sync.applyChanges: true`, so local runs repair them silently; this catches the un-committed repair.
3. `nx run-many -t typecheck lint test` — `lint` includes the Nx module-boundary rules, so a
   violation of the one-directional data flow (AGENTS.md §4) fails here.

The Nx local cache (`.nx/cache`) is restored via `actions/cache`, keyed on `package-lock.json`.

### `.github/workflows/deploy.yml`

1. **resolve** — picks the target environment and refuses production from a non-`main` ref.
2. **verify** — calls `ci.yml`.
3. **deploy** — bound to the matching GitHub Environment (so its scoped secrets apply), applies D1
   migrations, then deploys the four Workers.

`concurrency` is set with `cancel-in-progress: false`: cancelling between the migration step and the
Worker deploy would leave the schema ahead of the deployed code.

## Two ways to select an environment

This is the sharpest edge in the setup. The three TanStack apps use `@cloudflare/vite-plugin`, which
resolves the Cloudflare environment at **build** time and writes a flattened config that
`wrangler deploy` then picks up automatically. Passing `--env` to `wrangler deploy` is invalid for
them. `apps/worker-jobs` has no Vite build and uses the normal `--env` flag.

| App | Command |
| --- | ------- |
| `ui`, `dashboard`, `admin` | `CLOUDFLARE_ENV=<env> vite build && wrangler deploy` |
| `worker-jobs` | `wrangler deploy --env <env>` |

Both forms are encoded in the Nx `deploy:staging` / `deploy:production` targets, so use those rather
than calling wrangler directly. There is deliberately **no** bare `deploy` target: it would publish to
the top-level config, creating an unsuffixed fifth Worker outside either environment.

## Migrations run before builds

`vite build` writes `apps/<app>/.wrangler/deploy/config.json`, which redirects subsequent wrangler
commands in that directory to the flattened single-environment config — where `--env` no longer
applies. Migrations therefore run **first**, from `apps/worker-jobs` (which has no Vite build):

```sh
npm run migrate:staging      # nx run worker-jobs:migrate:staging
npm run migrate:production
npm run migrate:local        # local Miniflare D1
```

## Required GitHub configuration

Repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Purpose |
| ------ | ------- |
| `CLOUDFLARE_API_TOKEN` | Read automatically by wrangler |
| `CLOUDFLARE_ACCOUNT_ID` | Read automatically by wrangler |

Environments (**Settings → Environments**): `staging` and `production` — both created, neither
carrying protection rules (see above). Application secrets are **not** stored in GitHub: they live in
Cloudflare via `wrangler secret put` and survive redeploys. See [`secrets.md`](secrets.md).

## Deploying by hand

```sh
npm run deploy:staging       # nx run-many -t deploy:staging
npm run deploy:production
```

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the shell. Prefer the pipeline —
a manual production deploy bypasses the approval gate.

## Validating config without deploying

```sh
cd apps/worker-jobs && npx wrangler deploy --dry-run --env staging
cd apps/ui && CLOUDFLARE_ENV=staging npx vite build && npx wrangler deploy --dry-run
```

The dry run prints the resolved binding table, which is the fastest way to confirm an environment
points at the D1 database, Vectorize index and vars you expect. Delete `apps/ui/.wrangler/deploy`
afterwards so local `wrangler` commands stop being redirected to the built config.

## Why CI can fail where local passes

Three traps, all already hit and fixed — worth knowing before adding an app or a Worker binding.

**Gitignored codegen that no target depends on.** `libs/i18n/src/index.ts` re-exports
`./paraglide/messages.js` and `./paraglide/runtime.js`, which `paraglide-js compile` generates into a
gitignored directory. `i18n`'s own `typecheck`, `build` and `test` targets declare
`dependsOn: ["generate-i18n"]`, but the app `deploy:*` targets did not — so the staging deploy failed
with `UNRESOLVED_IMPORT` on a fresh checkout while passing locally, where the directory lingered from
an earlier run. `public`'s `typecheck` and both `deploy` targets now depend on `i18n:generate-i18n`
explicitly. `apps/dashboard` and `apps/admin` import no i18n, directly or transitively, so they are
deliberately left out. Reproduce with:

```sh
rm -rf libs/i18n/src/paraglide && npx nx run public:deploy:staging
```

The general rule: any target that bundles a library's *source* needs that library's codegen as a
`dependsOn`. Depending on `^build` is not enough, because Vite compiles `libs/*/src` directly and
never reads the `tsc` output.

**Generated Cloudflare types.** `worker-configuration.d.ts` is produced by `wrangler types` and is
gitignored, so it exists on a developer machine and never in CI. `apps/ui` originally relied on it for
the Workers runtime globals (`SendEmail`, `DurableObjectNamespace`, `ExportedHandler`, the
`cloudflare:workers` module), which typechecked locally and failed with 19 errors in CI. Any project
using Workers types must list `@cloudflare/workers-types` in its tsconfig `types` — as
`apps/admin`, `apps/worker-jobs` and `libs/server-fns` do — rather than depending on the generated
file. To reproduce CI locally, delete the file first:

```sh
rm -f apps/*/worker-configuration.d.ts && npx nx run-many -t typecheck
```

**Filename casing.** macOS is case-insensitive, Linux runners are not. An import of `./Button.js`
resolving to `button.tsx` works locally and fails outright in CI. AGENTS §5 requires the file name to
match the exported component in PascalCase; that rule is what keeps CI honest.

## Not yet wired

- **Playwright e2e smoke** (P0-021) — no post-deploy health check runs today.
- **Dependency/CVE scan** (§14 of the implementation plan).
