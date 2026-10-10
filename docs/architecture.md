# Architecture

How founders.coffee is built: what works, how the repository is laid out, how the layers fit, and the conventions that fail a build. The binding rules are in [`AGENTS.md`](../AGENTS.md), and what ships when is in the [implementation plan](./implementation-plan.md).

## What works today

In `apps/ui`: market and city discovery; passwordless email-OTP sign-in and the OAuth UI; public
member/host profiles; the anonymous-to-authenticated event creation wizard with Mapbox
venue selection; event listing and detail; RSVP; live attendance over Durable Object WebSockets;
city waitlists; an installable Serwist PWA; and Arabic, French and English with Arabic-first RTL.

The post-event loop is built and routed behind the `communityOperations` market flag: host
closeout, attendance evidence, the attendee feedback pulse, and reminder scheduling on Durable
Object alarms with push first and email fallback. What remains is operational rather than written:
production still runs a scheduler predating the current notification policy, and the admin
operations workspace — event operations, corrections, host trust and audit — is not built. Status
lives in the [implementation plan](./implementation-plan.md), never here.

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

Full rules live in [`AGENTS.md`](../AGENTS.md); these are the ones that fail a build:

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
