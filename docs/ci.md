# CI/CD — GitHub Actions → Cloudflare Workers

CI protects delivery of the [community-building release](./release-strategy.md). Future app shells
and dormant foundations may continue to compile, but they are not launch features. Per the current
project decision, Playwright E2E remains a local/staging release gate and is not run in CI.

Implements **P0-020**. Two workflows, two Cloudflare environments, four Workers per environment.

**Source configuration last checked: 2026-09-14.** The workflow files match the behavior below.
The latest GEO push ([run 34777686347](https://github.com/AmineYagoub/founders-coffee/actions/runs/34777686347))
reached `format:check` and failed only because `docs/implementation-plan.md` had drifted from
Prettier; this documentation update repairs that drift. Its migration and deploy jobs were skipped.
The prior staging deployment ([run 34770191868](https://github.com/AmineYagoub/founders-coffee/actions/runs/34770191868))
was green. GitHub environment and secret settings remain account-side facts and should be rechecked
before relying on a new deployment.

## Branch → environment mapping

| Trigger                | Cloudflare environment | Gate                           | Tags?         |
| ---------------------- | ---------------------- | ------------------------------ | ------------- |
| push to `develop`      | `staging`              | none — deploys automatically   | no            |
| push to `main`         | `production`           | the merge **is** the gate      | yes, `vX.Y.Z` |
| manual run from `main` | either                 | the manual run **is** the gate | no — redeploy |

A manual run against any other ref resolves to `staging`, and the `resolve` job refuses `production`
from a ref other than `main`, so no feature branch can reach production by either route.

### Why merging to `main` is the gate

The intended design was a required-reviewer rule on the `production` GitHub Environment. That
protection rule needs **GitHub Pro/Team on a private repository**; on the current plan the API
rejects it with:

> Failed to create the environment protection rule. Please ensure the billing plan supports the
> required reviewers protection rule.

So the reviewable moment is the pull request into `main`. That is a deliberate human action with a
diff attached, which is what the protection rule would have provided. It is weaker in one specific
way, and the weakness is worth naming: nothing stops a direct push to `main` by someone with write
access. If the plan is ever upgraded, add the rule and the gate becomes enforced rather than
conventional:

```sh
gh api -X PUT repos/<owner>/<repo>/environments/production \
  -f 'reviewers[][type]=User' -F "reviewers[][id]=$(gh api user --jq .id)"
```

A branch protection rule on `main` requiring a pull request is the cheaper half of the same
guarantee and does not need a paid plan.

Both `staging` and `production` GitHub Environments are required so environment-scoped secrets work;
verify their current existence and settings in GitHub.

## Workflows

### `.github/workflows/ci.yml`

Runs on pull requests (except documentation-only changes) and on pushes to `develop` and `main`.
The push run is the canonical verification for a commit; `deploy.yml` starts only after that run
finishes successfully. This avoids running the same full graph once as a deploy gate and again as
a push check. Needs **no** Cloudflare credentials — the integration tests run against Miniflare
with real local D1/Queues/Email bindings (AGENTS.md §12), not the live account.

The `quality` and `build` jobs run in parallel. On a `develop` → `main` release pull request, the
pull-request jobs are skipped because the push to `develop` already verified the exact commit; the
merge then produces one new `main` push run. Feature pull requests into `develop` still run the
pull-request jobs normally. Documentation-only pull requests are filtered out because they cannot
change application or deployment artifacts; pushes to the protected branches still run the full
check.

1. `npm ci --no-audit --no-fund` — skipped entirely when the `node_modules` cache hits.
2. `npm run format:check` — rejects formatting drift before the more expensive verification steps.
3. `nx sync:check` — asserts the tsconfig project references are committed. `nx.json` sets
   `sync.applyChanges: true`, so local runs repair them silently; this catches the un-committed repair.
4. `nx run worker-jobs:migrate:local` — applies the committed D1 migrations to the local staging
   database used by the default Cloudflare Vite prerender server. The deploy workflow selects the
   matching local target (`migrate:local` for staging, `migrate:local:production` for production),
   because the environment-specific UI configs use different D1 database names in the shared state.
   This keeps every build deterministic without requiring Cloudflare credentials or live data.
5. `nx run-many -t typecheck lint test --parallel=1` (quality job) — verifies the type graph,
   boundaries, and unit/integration tests. `lint` includes the Nx module-boundary rules, so a
   violation of the one-directional data flow (AGENTS.md §4) fails here.
6. `nx run-many -t build --parallel=1` (build job) — verifies every production build. The serial
   graph keeps Istanbul coverage output isolated between Miniflare projects.
7. `nx run public:integration-test` (build job) — exercises the Worker, SSR documents, redirects,
   robots, sitemap, indexation headers, and Early Hint filtering against Miniflare's real D1/R2/Queues
   bindings.

### Two caches, and why `npm ci` is usually skipped

The Nx local cache (`.nx/cache`) is restored via `actions/cache`, keyed on `package-lock.json`.

`node_modules` is cached separately, across the root and every workspace package
(`apps/*/node_modules`, `libs/*/node_modules` — this is an npm workspaces repo, so the tree is not
just the root one). It is about a gigabyte, and `npm ci` spent **seven minutes** on it even with
setup-node's warm ~/.npm cache: the cost is extraction and linking, not download. Restoring the tree
directly is roughly a minute, and the install step is skipped on a hit.

The key is the exact lockfile hash and the exact Node version, with **no `restore-keys`**. That is
deliberate: `restore-keys` would let a near-miss restore a tree built from a different lockfile, and
because a hit skips `npm ci`, the job would then run against dependencies that do not match the
lockfile. A miss must reinstall.

There are no `install`, `preinstall`, `postinstall` or `prepare` scripts anywhere in the workspace,
which is what makes restoring the tree equivalent to installing it.

### There is no dependency audit step

`npm audit --audit-level=high` was removed on 2026-09-04. npm is retiring the
`/-/npm/v1/security/audits/quick` endpoint this npm version calls; it began answering `400` and
`503`, taking five minutes to fail, and it blocked every deploy. Nothing in the pipeline checks
advisories now — GitHub's Dependabot alerts are the intended replacement and are configured in
repository settings, not here.

### `.github/workflows/deploy.yml`

1. **resolve** — for a successful CI push, picks the target environment from the CI run's branch;
   a manual run may choose its environment and production is still refused from a non-`main` ref.
2. **deploy** — starts only after the successful CI push, checks out that run's exact commit, and is
   bound to the matching GitHub Environment (so its scoped secrets apply). It applies D1
   migrations, deploys the four Workers, then runs the SEO route smoke against the deployed origin.
   Staging probes use the environment's `workers.dev` hostname and assert canonical URLs against
   `staging.founders.coffee`, so the gate tests the deployed Worker without depending on a
   custom-domain WAF challenge from GitHub-hosted runners. Production probes use `founders.coffee`.
   They send a browser User-Agent plus the private `x-founders-coffee-seo-smoke: 1` header. The
   production zone has the narrowly scoped custom skip rule in
   [`libs/infra/cloudflare/waf/seo-smoke-skip-rule.json`](../libs/infra/cloudflare/waf/seo-smoke-skip-rule.json),
   which applies to the four public discovery files and to GET requests for public locale paths
   carrying that header. Browser Integrity Check and the normal medium security level remain
   enabled for every other request. Production Bot Fight Mode is disabled because the Free plan
   applies it across the whole zone and cannot selectively exempt the monitor; WAF rules, rate
   limits, Turnstile, and Browser Integrity Check remain enabled.
   The smoke writes a JSON route report and the fetched sitemap, uploaded as a `seo-<environment>-<sha>`
   artifact. It covers all locales, company and market routes, discovered city/event routes, utility
   noindex/cache headers, robots, canonical URLs, and same-origin Early Hint links. Dynamic city/event
   coverage is reported when staging has public rows; an empty staging database is a valid state and
   does not fabricate fixtures. Playwright E2E remains excluded from CI by the current project decision.
3. **release** — only for a successful CI push to `main`. Tags that exact deployed commit and
   publishes a GitHub release. Manual redeploys never create a second tag.

`concurrency` is set with `cancel-in-progress: false`: cancelling between the migration step and the
Worker deploy would leave the schema ahead of the deployed code.

### SEO/GEO release review

Last reviewed: **2026-09-14**. Review owner: **Engineering**. Re-run the local or deployed smoke on
every release and during the monthly discovery review. The smoke validates one primary JSON-LD entity
per public page type, visible `h1`/`h2` hierarchy, canonical and locale parity, public-field
boundaries, and staging-safe `llms.txt` and `/events.json` responses. Keep the machine-readable feed
and `llms.txt` as discovery aids only; they do not replace the sitemap or SSR pages.

AI citation and recommendation monitoring is advisory. A citation, ranking, or recommendation is not
guaranteed by this contract. Record manual observations and any corrective action in the deployment
evidence without adding private member data or fabricated content to public surfaces.

## Versioning and releases

Versions are derived from the conventional commits (AGENTS.md §15) since the last release tag, by
`tools/release/next-release.mjs`. There is no release dependency and no bot commit: the git tag and
the GitHub release are the whole record.

| Since the last tag                 | Bump while major is `0` | Bump once major ≥ 1 |
| ---------------------------------- | ----------------------- | ------------------- |
| a `!` marker or `BREAKING CHANGE:` | minor                   | major               |
| any `feat`                         | minor                   | minor               |
| anything else                      | patch                   | patch               |

The first release is seeded at `v0.1.0`. A breaking change stays a minor bump while the major is `0`
because promoting it to `1.0.0` would claim a stability this release does not have.

Two properties are deliberate:

- **The tag is created after the deploy succeeds**, so a version that exists is a version that
  reached production. A failed deploy leaves no tag; re-running the workflow retries both.
- **`package.json` is never rewritten.** Nothing here is published to a registry, so a version field
  in a private workspace root would be a second source of truth that a bot commit to `main` would
  have to keep in step — and that commit would re-trigger the workflow it came from.

Preview the next release locally without tagging anything:

```sh
node tools/release/next-release.mjs --notes /tmp/notes.md && cat /tmp/notes.md
```

The version rules are unit-tested in `tools/release/version.test.mjs` (`nx run workspace-root:test`).

## Two ways to select an environment

This is the sharpest edge in the setup. The three TanStack apps use `@cloudflare/vite-plugin`, which
resolves the Cloudflare environment at **build** time and writes a flattened config that
`wrangler deploy` then picks up automatically. Passing `--env` to `wrangler deploy` is invalid for
them. `apps/worker-jobs` has no Vite build and uses the normal `--env` flag.

| App                        | Command                                              |
| -------------------------- | ---------------------------------------------------- |
| `ui`, `dashboard`, `admin` | `CLOUDFLARE_ENV=<env> vite build && wrangler deploy` |
| `worker-jobs`              | `wrangler deploy --env <env>`                        |

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
npm run migrate:local        # local Miniflare staging D1
npx nx run worker-jobs:migrate:local:production # local Miniflare production-named D1
```

Local Cloudflare state lives in **one** directory at the repository root, `.wrangler/state`, shared
by every app. Wrangler resolves `.wrangler/state` against the working directory, so before this each
app had its own D1 file under the same database name: `migrate:local` migrated the `apps/worker-jobs`
copy while `npm run ui:dev` served the `apps/ui` copy, and a migration could report success against a
database nothing reads. `apps/ui` sets `persistState` on the Cloudflare Vite plugin and
`apps/worker-jobs` passes `--persist-to ../../.wrangler/state`.

A one-off CLI command needs neither flag. Without `--persist-to`, Wrangler resolves `.wrangler/state`
relative to the app's Wrangler configuration file — there is no persist key and no environment
variable to change that, only the flag. `npm run setup:local` (also run on `postinstall`) therefore
symlinks each `apps/*/.wrangler/state` at the shared directory, so the default path lands on the
shared database whether or not anyone remembers:

```sh
cd apps/ui && npx wrangler d1 execute founders-coffee-db-staging \
  --local --command "SELECT COUNT(*) FROM user"
```

The linker never deletes an app-local state directory that holds data; it reports it and leaves it,
because that directory is somebody's database. Move what you need into `.wrangler/state`, delete the
rest, and run `npm run setup:local` again.

## Required GitHub configuration

Repository secrets (**Settings → Secrets and variables → Actions**):

| Secret                  | Purpose                        |
| ----------------------- | ------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Read automatically by wrangler |
| `CLOUDFLARE_ACCOUNT_ID` | Read automatically by wrangler |

Environments (**Settings → Environments**): `staging` and `production`, currently intended without
protection rules (see above). Application secrets are **not** stored in GitHub: they live in
Cloudflare via `wrangler secret put` and survive redeploys. See [`secrets.md`](secrets.md).

## Deploying by hand

```sh
npm run deploy:staging       # nx run-many -t deploy:staging
npm run deploy:production
```

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the shell. Prefer the pipeline —
a manual production deploy bypasses the approval gate.

Run the same post-deploy SEO contract locally (the command writes the JSON report and sitemap paths
passed to it):

```sh
npm run seo:smoke -- --origin https://staging.founders.coffee \
  --output /tmp/seo-route-report.json --sitemap-output /tmp/sitemap.xml
```

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

The general rule: any target that bundles a library's _source_ needs that library's codegen as a
`dependsOn`. Depending on `^build` is not enough, because Vite compiles `libs/*/src` directly and
never reads the `tsc` output.

**The same trap, found again on 2026-09-04.** `libs/domain`, `libs/email` and `libs/server-fns` all
import `@founders-coffee/i18n`, and none of their `test` targets declared the codegen. It surfaced
as a task Nx labelled flaky: under `--parallel`, `domain:test` read
`libs/i18n/src/paraglide/messages/*.js` while `generate-i18n` was rewriting that directory, and got
`Cannot find module '../runtime.js'` — the messages were on disk, the runtime they import was not,
yet. Serially it passed, because the gitignored directory lingers from an earlier run.

`--parallel=8` reproduced it three times out of three and, with the `dependsOn` added, passed three
times out of three. Reproduce either way with the cold-start form:

```sh
rm -rf libs/i18n/src/paraglide && npx nx run domain:test --skip-nx-cache
```

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

## `dangerouslyIgnoreUnhandledErrors` in `libs/server-fns`

Better Auth's router settles the `Response` a caller awaits and separately drops the `APIError` its
endpoint threw, so every test that deliberately submits a wrong or expired code — most of the
PF-07c contact-change suite — ends the run with an unhandled rejection that no caller could have
caught. The flag is set on that project alone, and only because the rejection originates inside a
dependency: an `unhandledrejection` listener in `setup.ts` was tried first and never fires under the
Workers pool.

What it costs: a genuine unhandled rejection in `libs/server-fns`' own code no longer fails that
project's run. Every other project keeps the default. Remove the flag when the upstream router stops
orphaning the promise, and check by deleting it and running the contact suites.
