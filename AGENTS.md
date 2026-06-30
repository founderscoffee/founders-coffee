# AGENTS.md — Engineering Constitution for founders.coffee

> **Read this before writing or modifying any code.** These are binding rules, not suggestions. They encode the locked architecture, the DRY/separation discipline, the security baseline, and the production-quality bar. When this file conflicts with older code, **this file wins** — fix the code.

## 0. Authoritative references (in order)

1. **This file** — *how* we build (rules).
2. [`docs/srs.md`](docs/srs.md) — *what* we build (requirements, `FR-*`/`NFR-*`).
3. [`docs/implementation-plan.md`](docs/implementation-plan.md) — *when* we build it (phases, tickets).
4. Parent `~/CLAUDE.md` — repo tooling (code-review-graph MCP: use graph tools before grep/glob).

Every code change maps to a ticket ID in the plan, which maps to `FR-*`/`NFR-*` in the SRS. No orphan work.

---

## 1. Golden rules (non-negotiable)

1. **No stubs. No mocks. No placeholders. No `TODO`.** Production code must be fully implemented and working. If a dependency isn't ready, the work is **blocked** — never faked. "I'll wire this later" is forbidden; ship it real or don't ship it.
2. **DRY across apps.** All domain logic, DB access, auth, i18n, UI, server functions, and integrations live **once** in `libs/*` and are consumed by all apps. Duplication between `apps/ui`, `apps/dashboard`, `apps/admin` is a defect.
3. **Strict one-directional data flow.** Components → hooks → api → server-fns → domain → db → D1. Enforced by Nx tags + lint (§4). No layer skips.
4. **Security by default.** Validate every input (Zod). Authorize every server function. Rate-limit + Turnstile every state-changing endpoint. Secrets only in `wrangler secret`/Secrets Store.
5. **Type safety end-to-end.** Zod is the single source of truth; types are inferred. No `any`. Strict TS everywhere.
6. **Real platform in tests.** Test against **Miniflare** (real local D1/R2/KV/Queues/AI/Vectorize). Never mock Cloudflare bindings. E2E via Playwright against local Workers.
7. **Production-grade from ticket #1.** Observability, error handling, validation, and tests are part of each feature — never a "later phase."
8. **Ask before expanding scope.** Before adding any new dependency, Cloudflare service, or external integration, **surface it and ask**. Do not silently introduce vendors or libraries.

---

## 2. Tech stack (locked — do not deviate)

**Use exactly these. Anything else requires explicit approval.**

- **Monorepo:** Nx 23 + TanStack Config. TypeScript 5.9, **strict**.
- **Apps:** TanStack Start (fullstack: SSR + typed server functions). Runtime: **Cloudflare Workers**.
- **TanStack:** Router, Query (server state), Form (forms), Table (data grids), Virtual (long lists), Store (client UI state).
- **Styling:** **Tailwind CSS v4 + DaisyUI** (shared in `libs/ui`).
- **Validation:** **Zod** (source of truth for types).
- **DB:** **Cloudflare D1** + **Drizzle ORM**.
- **Auth:** **Better Auth** (email/password + phone OTP; cookie + token).
- **Cloudflare services:** D1, R2, Images, KV, Queues, Cron, Durable Objects, Workflows, Workers AI, Vectorize, Browser Rendering, Turnstile, Access/Zero Trust, Email (native), Analytics Engine, Web Analytics, Secrets Store, Smart Placement.
- **Email:** Cloudflare Email (native) + React Email templates.
- **Mobile:** PWA Builder wraps `apps/ui`.
- **Testing:** Vitest + Playwright + Miniflare.

**Forbidden stack:** NestJS, Prisma, Express, Next.js, Redux, raw `fetch` in components, Node-only libraries (unless `nodejs_compat`-verified), mock frameworks for Cloudflare bindings.

> `apps/api` (NestJS) is **legacy/deprecated** — do not extend it. It will be removed during P0. All backend logic lives in `libs/server-fns`.

---

## 3. Repository layout (where things go)

```
apps/
  ui/              # public site + PWA — anon, SEO/prerendered
  dashboard/       # founders/hosts/sponsors — authenticated
  admin/           # project owners — authenticated + Cloudflare Access gated
  worker-jobs/     # Queue + Cron consumers (no UI)
libs/
  core/            # env, config, Money, Result/Error, feature-flags, ids
  db/              # Drizzle schema (ALL tables), migrations, repositories, D1 helpers
  domain/          # PURE business logic per domain (no I/O imports)
  auth/            # Better Auth server + client + RBAC
  server-fns/      # createServerFn definitions per domain (the backend)
  i18n/            # locales, RTL, fallback, money/date formatting
  ui/              # Tailwind v4 + DaisyUI design system, shared components
  ai/              # Workers AI + Vectorize clients
  payments/        # PaymentProvider interface + ManualProvider (Y1) + DZ adapters (P4)
  email/           # Cloudflare Email + React Email templates
  observability/   # logger, Analytics Engine metrics, error reporting
  infra/           # wrangler configs, typed Env (wrangler types), seeds, Nx tags
```

### Per-app internal structure (mandatory)

```
apps/<app>/src/
  routes/              # TanStack Router file-based routes — thin (layout + wiring only)
  features/
    <domain>/          # events/, challenges/, sponsorships/, ...
      api.ts           # ONLY place that imports libs/server-fns
      hooks.ts         # TanStack Query hooks — ONLY thing components call for data
      components/      # domain components
      types.ts         # local view types (inferred from Zod where possible)
  components/          # app-level cross-domain shared components (Layout, Nav)
  lib/                 # app bootstrap (query client, router context, providers)
```

**Domain folders are the unit of organization.** A feature's components, hooks, and api live together; cross-feature reuse goes through `libs/ui` or `libs/domain`.

---

## 4. Architecture & data-flow contract (enforced)

```
Component → hook (TanStack Query) → api.ts → libs/server-fns → libs/domain → libs/db → D1
```

**Nx project tags** classify projects (`type:app|lib`, `domain:*`, `layer:ui|server|data`). **`@nx/eslint-plugin` dependency rules** enforce:

- `layer:ui` **may not** import `layer:server` or `layer:data` (no server-fns/db/drizzle/domain in components).
- `layer:server` **may not** import `layer:ui`.
- Apps depend only on `libs/*`, **never** on sibling `apps/*`.
- Boundary violations are **build-breaking lint errors**, not warnings.

If you need data in a component that the current hook doesn't provide → add/extend the hook. Never reach past the `api.ts` layer.

---

## 5. Code-quality bar

- **Strict TypeScript.** No `any`. No `@ts-ignore`/`@ts-expect-error` without an inline justification comment. `noUnusedLocals`, `noImplicitReturns`, strict null checks — on.
- **Naming:** clear, domain-aligned, no abbreviations except well-known ones (`id`, `url`). Boolean props prefixed `is`/`has`/`can`. **All functions and methods use camelCase** — no exceptions.
- **Functions:** small, single-purpose, pure where possible. Side effects live in server functions / repositories, not in components or domain logic.
- **Route files are thin.** Route files (`routes/*.tsx`) contain **only** layout + wiring (auth guard, data loading, hooks). **Zero component logic** in route files — all UI components live in `components/` or `features/<domain>/components/`.
- **Component naming = file name.** The exported component name must exactly match the file name in PascalCase: `DatetimePicker.tsx` exports `DatetimePicker`, `MapPicker.tsx` exports `MapPicker`. No mismatches.
- **Arrow functions only.** Declare all functions, methods, and components as arrow functions (`const f = () => {}`), including object-literal methods and class methods (use arrow class fields so `this` binds to the instance). Exceptions: generator functions (`function*`) and any case where arrow syntax would change `this` binding.
- **No inline comments.** Do not write `//` line/inline comments — names and structure are the documentation. JSDoc block comments (`/** */`) for public API docs are encouraged; toolchain directive comments (`eslint-disable`, `@ts-*`) are exempt.
- **`libs/domain` is pure:** no Drizzle, no `Env`, no `fetch`. It takes inputs and returns outputs. I/O stays in `libs/db` and `libs/server-fns`.
- **Error handling:** `libs/domain` returns the `Result` envelope; server functions unwrap it via `handleResult()` (the **throw boundary**) — throwing the typed `AppError` on failure, never raw/untyped throws. See §7.
- **No dead code, no commented-out code, no `console.log`** in committed code. Use the structured logger (`libs/observability`).
- **Imports:** ordered (external → `libs/*` → relative), no unused, no circular (enforced by lint).
- **Readability over cleverness.** Code is read 10× more than written. Optimize for the reader.

---

## 6. Domain modeling rules

- **Money:** ALWAYS the `Money` value object from `libs/core` — `{ amount_minor: number (integer), currency: string (ISO 4217) }`. **Never** a bare number. **Never** floating-point math on money. All arithmetic in integer minor units.
- **Schemas first:** define a Zod schema for every entity/command; infer TS types (`z.infer`). Shared primitives (Money, id, pagination, market code) live in [`libs/core/validation.ts`](../libs/core/src/validation.ts); per-domain schemas in `libs/domain/<domain>/schemas.ts`. The schema is the single contract shared by `api.ts`, server functions, and forms (DRY). Server functions validate input via `createServerFn().validator(appValidator(schema))` — invalid input throws `AppError('validation_failed')` (the §7 throw boundary). See [`docs/validation.md`](validation.md).
- **Geo/market scoping:** every user-facing record carries `market_id` (and `city_id` where geographic) from creation. No global queries that silently cross markets.
- **Time:** store UTC; render in the city/market timezone via `libs/i18n`. Never store localized times.
- **IDs:** from the `libs/core` id factory — consistent format, no ad-hoc UUIDs in different styles.
- **Enums/status:** as string union types backed by Zod enums; status transitions live in `libs/domain` (e.g., Order: `pending → paid → refunded`).

---

## 7. Server-function rules (`libs/server-fns`)

Every server function (`createServerFn`):

1. **Validates input** with a Zod schema via `appValidator(schema)` — throws `AppError('validation_failed')` on invalid input (inferred types exported for `api.ts`).
2. **Declares required permission** (RBAC); checked by the shared authz middleware — never inline checks.
3. **Resolves the active market/city** from context; scopes all reads/writes.
4. **Unwraps** the domain `Result` via `handleResult()` *inside the handler* — **throws** the typed `AppError` on `!ok` (stable code + message), returns data on `ok`. Server functions are the **throw boundary**: the thrown `AppError` is serialized by TanStack Start, so `useQuery`/`useMutation` enter `error` automatically. No leakage of internals. Read the client-side `code` via `appErrorCode()`.
5. **Logs** entry/failures via `libs/observability` (structured, with market/request context).
6. **Calls** `libs/domain` for logic and `libs/db` for persistence — never the reverse dependency.

State-changing server functions (create event, RSVP, signup, submit challenge) are additionally **rate-limited (Durable Object + WAF — never KV; see §11.5)** and **Turnstile-protected** at the edge/middleware layer.

---

## 8. Component rules

- **Presentational + thin.** Components receive props, call hooks (`hooks.ts`) for data, and dispatch via hooks. They **never** import server functions, DB, Drizzle, or domain internals.
- **Organized by domain** in `features/<domain>/components/`. Cross-domain shared UI lives in `libs/ui`.
- **Styling:** Tailwind v4 + DaisyUI. Use design tokens / DaisyUI components; avoid arbitrary inline values where a token exists. RTL-aware (use logical properties — `ps-`/`pe-`/`ms-`/`me-`, not `pl-`/`pr-`).
- **Forms:** TanStack Form + the domain's Zod schema (reused — DRY).
- **Tables/grids:** TanStack Table. **Long lists:** TanStack Virtual.
- **Client UI state** (toasts, modals, non-server state): TanStack Store.
- **Accessibility:** WCAG 2.1 AA. Semantic HTML, keyboard nav, focus management, ARIA only when semantic HTML is insufficient. Every interactive element reachable by keyboard.
- **Loading/error/empty states are mandatory** for every data-bound view — including the "be the first host" empty state for cities with no events.

---

## 9. i18n & RTL rules

- **Zero hardcoded user-facing strings.** All copy in `libs/i18n` locale resources.
- **Every screen must work in both RTL and LTR.** Direction is driven by the active locale/market. Test both.
- **Locale fallback chain** (`ar-EG → ar → en`); never break the UI on a missing translation.
- **User-generated content is not auto-translated.** Tag it with a language code; render as authored.
- **Format** dates, times, numbers, and currency per active locale + market timezone.

---

## 10. Security rules

- **Authn:** Better Auth only. **Sessions in D1 (via Drizzle) — not KV** (KV is eventually consistent; see §11.5). Token strategy ready for future non-web clients.
- **Authz:** centralized RBAC (`member`, `host`, `sponsor_contact`, `moderator`, `admin`). Permission declared per server function; enforced in one middleware. **Never** spread authz checks ad hoc.
- **Input validation:** Zod at every server-function boundary. No unvalidated input reaches domain/DB.
- **Bot protection:** Turnstile on signup, login, event creation, RSVP, challenge submission.
- **Rate limiting:** **Durable Object token-bucket** (identity-scoped, strongly consistent) + **Cloudflare WAF Rate Limiting** (blunt volume, edge) — **never KV** (see §11.5).
- **Admin isolation:** `apps/admin` is gated by **Cloudflare Access** (team SSO/allow-list) **and** the Worker verifies the `Cf-Access-Jwt-Assertion` JWT against the team JWKS + **disables its `workers.dev` route** (Access alone is bypassable via the raw Worker URL).
- **Secrets:** `wrangler secret` / Secrets Store only. Never committed. `.env` for local dev only; `.env.example` sanitized.
- **Headers:** secure-headers middleware; strict CSP with nonces; HTTPS-only; cookies `Secure; HttpOnly; SameSite=Lax`.
- **Uploads:** worker-mediated to R2; MIME + size validation; images served through Cloudflare Images transforms. No raw HTML injection of uploads.
- **OWASP Top-10:** addressed per NFR-4. Dependency/CVE scan in CI.

---

## 11. Database rules (D1 + Drizzle)

- **Schema in one place:** `libs/db` (Drizzle). Never define tables elsewhere.
- **Migrations:** `wrangler d1 migrations` via Drizzle kit. **Never** change schema without generating/applying a migration. Migrations are reviewed and committed.
- **No raw SQL bypass** of the repository layer except for performance-justified, reviewed queries in `libs/db`.
- **Queries:** use Drizzle's query builder; parameterize everything (no string interpolation into SQL).
- **Transactions — D1 is batch-only:** D1 supports **batch** transactions (`db.batch([...])`) but **not interactive read→decide→write** across awaits. A Drizzle `db.transaction(async tx => { const x = await tx.select(); if (x) await tx.update(); })` is **not atomic** on D1 — it is a TOCTOU race. For check-then-write use **single atomic SQL** (`INSERT … SELECT … WHERE`, `ON CONFLICT`, CTEs, atomic `UPDATE … WHERE rsvps < cap`) inside `db.batch()`. Provide a `libs/db` atomic helper so the unsafe pattern is hard to reach for (see §11.5).
- **Performance:** watch query cost (D1 throughput is tied to query duration). Index hot paths. Avoid N+1. Re-review before crossing the §8.7 D1 size ceiling (monitor monthly).
- **Seeds:** market/city/reference data via `libs/infra` seeds (DZ active, MA open, …).

---

## 11.5 Cloudflare platform constraints (binding — from architecture review)

These are non-negotiable platform-specific rules; several correct common mistakes.

- **Workers KV is eventually consistent (~60s).** **NEVER** use KV for rate-limiting counters (use a Durable Object + WAF), session storage (use D1), or any read-after-write that must be consistent. KV is for hot cache, feature flags, and idempotent reads only.
- **D1 transactions are batch-only** (see §11). Never write interactive read→write logic.
- **Scheduling: Durable Object Alarms, not cron-polling.** For per-entity timed work (event reminders at `starts_at − 2h`, challenge phase transitions), set a DO alarm when the entity is created; the DO wakes precisely and pushes to the `NOTIFICATIONS` queue. **No global cron that scans D1.** A low-frequency cron may exist *only* as a backstop sweeper for missed alarms.
- **Durable Object location:** set a **location hint** near the user base (Maghreb/EU) at creation; persist state in `state.storage` and write-through to D1. Reserve DOs for genuine real-time/coordination — prefer atomic D1 SQL for simple counters (e.g., RSVP capacity: `UPDATE events SET rsvps = rsvps + 1 WHERE id = ? AND rsvps < capacity`).
- **External services go behind provider interfaces.** SMS, email, images, payments: each gets an interface (`SmsProvider`, `EmailProvider`, `ImageProvider`, `PaymentProvider`) with a **dev variant** (`DevSmsProvider` logs the OTP to console; dev image adapter serves raw R2 bytes) and a real variant. Mocking an *external service* via its interface is allowed; **mocking a Cloudflare binding is not** (use Miniflare).
- **TanStack Query × throw boundary:** server functions unwrap the domain `Result` *inside the handler* via `handleResult()` — they **throw** the typed `AppError` on failure, so `useQuery`/`useMutation` enter `error` automatically. The thrown `AppError.code` crosses the wire at runtime (TanStack serializes it; TS types the client error generically — the [#6428] gap — read it via the shared `appErrorCode()` accessor). Do **not** call `handleResult` at the component/hook layer.
- **Turnstile verification** must forward `CF-Connecting-IP` as `remoteip` (helper in `libs/core`/`libs/server-fns`).
- **`apps/admin` Access JWT** must be verified in-Worker (see §10); never rely on edge Access alone.

---

## 12. Testing rules

- **Write tests with the feature, not after.** A ticket isn't done until tests pass.
- **Unit (Vitest):** pure logic in `libs/domain` (money math, capacity, scoring, status machines).
- **Integration (Vitest + Miniflare):** server functions + repositories against **real local** D1/R2/KV/Queues/AI/Vectorize. **Never mock Cloudflare bindings.**
- **Component (Vitest + Testing Library):** presentational components in isolation.
- **E2E (Playwright):** critical flows per app (signup → create event → RSVP; admin confirms sponsorship; challenge submit → judge → winner).
- **Coverage gates** on `libs/domain` and `libs/server-fns`. No skipping tests with `.skip` in committed code without a linked ticket.

---

## 13. Observability rules

- **Structured logging** (`libs/observability`) with market + request context on every server path.
- **Analytics Engine** metrics for product events (events created, RSVPs, density per city/market, payments confirmed).
- **Alerting** on payment-confirmation backlog, error-rate spikes, and D1 size growth.
- **No `console.*`** in committed code.

---

## 14. Performance rules

- **Budget:** event listing/detail server functions respond ≤ 300ms (p95) at MVP load (NFR-1).
- **Workers are edge + short-lived:** no in-memory state across requests (use Durable Objects / KV / D1 for state).
- **Caching:** KV for hot config/flags; Cache API where appropriate. Invalidate deliberately.
- **Frontend:** code-split via TanStack Router; virtualize long lists; prefetch route data.

---

## 15. Git, commits & PRs

- **One ticket per PR.** PR title/description references the ticket ID and the `FR-*`/`NFR-*` it implements.
- **Conventional commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`), scoped to the domain (`feat(events): …`).
- **CI must be green:** typecheck, lint, **boundary checks**, unit + integration (Miniflare), e2e (smoke). No merging on red.
- **Small, reviewable diffs.** If a PR touches more than one concern, split it.
- **Never commit secrets**, `.env`, `dist/`, or `wrangler`-generated `.wrangler/` artifacts (`.gitignore` must cover them).

---

## 16. NEVER (the hard fence)

- **NEVER** ship stubs, mocks, placeholders, `TODO`, or fake data in production code.
- **NEVER** let a component import `libs/server-fns`, `libs/db`, `libs/domain`, or Drizzle.
- **NEVER** represent money as a bare number or float.
- **NEVER** hardcode user-facing strings.
- **NEVER** add a dependency, Cloudflare service, or external integration without surfacing it and asking first.
- **NEVER** use a Node-only library without verifying Workers/`nodejs_compat` compatibility.
- **NEVER** throw an *untyped* error past the server-function boundary — throw the typed `AppError` (after unwrapping the domain `Result` via `handleResult`).
- **NEVER** skip authz on a server function.
- **NEVER** store secrets in code or commit `.env`.
- **NEVER** use `any`, or `@ts-ignore`/`@ts-expect-error` without justification.
- **NEVER** mock Cloudflare bindings in tests — use Miniflare.
- **NEVER** use KV for rate-limiting, sessions, or any read-after-write that must be consistent (KV is eventually consistent).
- **NEVER** write interactive read→write transaction logic on D1 (it is not atomic) — use atomic single-statement SQL or `db.batch()`.
- **NEVER** gate `apps/admin` on Cloudflare Access alone — always verify `Cf-Access-Jwt-Assertion` in-Worker and disable the `workers.dev` route.
- **NEVER** change the DB schema without a migration.
- **NEVER** extend `apps/api` (NestJS) — it is deprecated.
- **NEVER** merge with failing typecheck/lint/boundary/tests.

---

## 17. Definition of Done (every change)

- [ ] Real implementation — no stubs/placeholders/TODOs.
- [ ] Inputs Zod-validated; types inferred and reused.
- [ ] Authz + rate-limit + Turnstile where state-changing.
- [ ] Money via `Money` value object; no bare numbers.
- [ ] i18n complete (fr-DZ + ar-DZ); RTL verified.
- [ ] Errors via the throw boundary (`AppError` after `handleResult`); structured logs on server paths.
- [ ] Tests written and passing (Miniflare/Playwright — real platform).
- [ ] Lint, typecheck, and **Nx boundary checks** pass.
- [ ] Maps to a ticket ID and `FR-*`/`NFR-*`.
- [ ] No secrets, no `console.*`, no dead code.

---

## 18. When in doubt

- **Ambiguity about *what* to build** → check `docs/srs.md`. Still unclear → ask.
- **Ambiguity about *when* or sequencing** → check `docs/implementation-plan.md`.
- **Tempted to add a library/service/integration** → stop and ask (§1.8).
- **Tempted to skip a rule "just this once"** → don't. The rules exist because the team chose them deliberately. Raise it in a ticket instead.
