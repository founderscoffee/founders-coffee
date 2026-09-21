# founders.coffee

**An Arabic-first platform for informal local founder meetups.**

[![CI](https://github.com/founderscoffee/founders-coffee/actions/workflows/ci.yml/badge.svg)](https://github.com/founderscoffee/founders-coffee/actions/workflows/ci.yml)
[![Deploy](https://github.com/founderscoffee/founders-coffee/actions/workflows/deploy.yml/badge.svg)](https://github.com/founderscoffee/founders-coffee/actions/workflows/deploy.yml)

The first release exists solely to build a real, durable local founder community: discovery, free
café and coworking meetups, hosting, RSVP, repeat participation, and trusted local relationships.

Hackathons, sponsorship, talent workflows, payments, and market expansion are documented roadmap
options, not current scope. They begin only after the community shows durable density and repeat
participation — see the [release strategy](./docs/release-strategy.md).

## What works today

In `apps/ui`: market and city discovery; passwordless email-OTP sign-in and the OAuth UI; onboarding
and public member/host profiles; the anonymous-to-authenticated event creation wizard with Mapbox
venue selection; event listing and detail; RSVP; live attendance over Durable Object WebSockets;
city waitlists; an installable Serwist PWA; and Arabic, French and English with Arabic-first RTL.

The post-event loop is built and routed behind the `communityOperations` market flag: host
closeout, attendance evidence, the attendee feedback pulse, and reminder scheduling on Durable
Object alarms with push first and email fallback. What remains is operational rather than written:
production still runs a scheduler predating the current notification policy, and the admin
operations workspace — event operations, corrections, host trust and audit — is not built. Status
lives in the [implementation plan](./docs/implementation-plan.md), never here.

## Repository layout

An [Nx](https://nx.dev) monorepo. Four Cloudflare Workers, twelve shared libraries.

| App                | What it is                             | In this release           |
| ------------------ | -------------------------------------- | ------------------------- |
| `apps/ui`          | The public app — members and hosts     | Yes                       |
| `apps/admin`       | Internal operations console            | Moderation and trust only |
| `apps/worker-jobs` | Background delivery and scheduled work | Yes                       |
| `apps/dashboard`   | Future sponsor portal                  | No                        |

| Library              | Layer  | Responsibility                                         |
| -------------------- | ------ | ------------------------------------------------------ |
| `libs/core`          | shared | `Money`, ids, `Result`, shared Zod primitives, config  |
| `libs/domain`        | domain | Pure feature logic — no Drizzle, no `Env`, no `fetch`  |
| `libs/db`            | data   | Drizzle schema, migrations, repositories over D1       |
| `libs/server-fns`    | server | TanStack server functions: validate, authz, rate-limit |
| `libs/auth`          | server | Better Auth — email OTP, OAuth, sessions               |
| `libs/email`         | server | Transactional mail                                     |
| `libs/notifications` | server | Web push, SMS fallback                                 |
| `libs/payments`      | server | Dormant — future roadmap, not current scope            |
| `libs/ui`            | ui     | Cross-domain components                                |
| `libs/i18n`          | shared | Paraglide messages, RTL, timezone rendering            |
| `libs/infra`         | shared | `Env` typing and binding access                        |
| `libs/observability` | shared | Structured logging, request context, metrics           |

Inside an app, **the domain folder is the unit of organization**: a feature's components, hooks and
`api.ts` live together under `features/<domain>/`, and cross-feature reuse goes through `libs/ui` or
`libs/domain`.

## How the layers fit

One direction, no shortcuts:

```text
component → hook (TanStack Query) → api.ts → libs/server-fns → libs/domain → libs/db → D1
```

Nx project tags (`type:*`, `domain:*`, `layer:*`) and `@nx/eslint-plugin` turn that into a
build-breaking lint error rather than a convention:

- `layer:ui` may not import `layer:server` or `layer:data` — no server functions, Drizzle or domain
  internals in a component;
- `layer:server` may not import `layer:ui`;
- apps depend only on `libs/*`, never on a sibling app.

If a component needs data its hook doesn't provide, extend the hook. Never reach past `api.ts`.

Every server function validates its input with a shared Zod schema, declares the permission it
requires, scopes reads and writes to the active market, and unwraps the domain `Result` at the throw
boundary so the client receives a typed `AppError`.

## Conventions that bite

Full rules live in [`AGENTS.md`](./AGENTS.md); these are the ones that fail a build:

- **300 lines per file**, counting blanks and comments. Over the cap means the file does more than
  one job — split it, never reformat under the limit.
- **Arrow functions only**, including object and class methods. Generators and constructors excepted.
- **Comments:** `.tsx` carries none at all; `.ts` carries only JSDoc on a function; config files carry
  none. Rationale for a decision belongs in `docs/` and the commit that made it.
- **A component's file name is its exported name**, in PascalCase. Linux runners are case-sensitive
  even where macOS is not.
- **Money is never a bare number** — always the integer-minor-unit `Money` value object.
- **Conventional commits**, scoped to the domain: `feat(events): …`. The release version is derived
  from them, so the type is not decoration.

## Local development

Node.js 22.

```sh
npm ci
npm run migrate:local
npm run seed:local
npm run ui:dev
```

The public app runs at `http://localhost:3000`. Copy the relevant `.dev.vars.example` before
exercising authentication, maps, or external providers — see [`docs/secrets.md`](./docs/secrets.md).

`seed:local` fills the local database with the three launch markets, three accounts and three
events, and is safe to re-run — every row yields to whatever is already there, so it never
overwrites something you changed by hand. The events exist so that each operations path has
something to run against: one has already ended and holds RSVPs, which is what the closeout and
feedback commands require; one is still ahead, because RSVP intent freezes at `startsAt`; one sits
in a second market. Sign in as `dev-host@dev.invalid`, `dev-member@dev.invalid` or
`dev-member-two@dev.invalid` — the addresses are unroutable, so the one-time code is written to the
dev server log rather than sent. The seed only ever writes to the local database and refuses
`--remote` and `--env`.

## Quality gates

```sh
npx nx sync:check      # committed tsconfig project references
npm run format:check
npm run typecheck
npm run lint           # includes the Nx module-boundary rules
npm run test
npm run build
npx nx run public:e2e  # Playwright — local/staging only, not in CI
```

Integration tests run against Miniflare with real local D1, Durable Object, Queue and Email
bindings. **Cloudflare bindings are never mocked.** The Playwright flow is deliberately a
local/staging release gate rather than a CI step.

## Environments and releases

| Trigger                | Cloudflare environment | Then                               |
| ---------------------- | ---------------------- | ---------------------------------- |
| push to `develop`      | `staging`              | —                                  |
| push to `main`         | `production`           | tag `vX.Y.Z` and publish a release |
| manual run from `main` | either                 | redeploy only, no tag              |

Merging to `main` is the production approval gate. D1 migrations always run before the Workers
deploy, and the deploy is never cancelled mid-flight.

The version is derived from the conventional commits since the last tag and starts at `v0.1.0`.
While the major is `0`, a breaking change is a minor bump, a `feat` is a minor bump, and everything
else is a patch. Tags are created **after** a successful production deploy, so a version that exists
is a version that reached production.

See [`docs/ci.md`](./docs/ci.md), [`docs/provisioning.md`](./docs/provisioning.md), and
[`docs/deployment-evidence.md`](./docs/deployment-evidence.md).

## Documentation

Read these in order before changing code:

1. [`AGENTS.md`](./AGENTS.md) — binding engineering rules.
2. [`docs/srs.md`](./docs/srs.md) — approved product and architecture requirements.
3. [`docs/release-strategy.md`](./docs/release-strategy.md) — the community-only release boundary.
4. [`docs/implementation-plan.md`](./docs/implementation-plan.md) — delivery status and sequencing.

Active plans: [event creation](./docs/event-creation-remediation-plan.md),
[audit remediation](./docs/audit-remediation-plan.md),
[community operations](./docs/community-operations-implementation-plan.md).
