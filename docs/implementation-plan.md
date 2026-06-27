# Implementation Plan
## founders.coffee — Production build plan (P0–P4)

| Field | Value |
|---|---|
| Document | Implementation Plan — founders.coffee |
| Version | 1.0 |
| Status | Ready to execute |
| Owner | Engineering |
| Last updated | 2026-06-25 |
| Derived from | [SRS v1.1](./srs.md) |
| Persona | Senior Principal Engineer — security, scalability, DRY, zero stubs |

> This plan converts every `FR-*`/`NFR-*` in the SRS into small, trackable tickets grouped by phase. P0 and P1 are specified at ticket level (they are next). P2–P4 are specified as epics with anchor tickets and will be refined into full tickets at the end of the prior phase (avoiding stale detail).

---

## 1. Engineering principles (non-negotiable)

1. **No mocks, no stubs, no placeholders.** Every ticket ships **real, working code**. No `// TODO`, no fake returns, no hardcoded data in production paths. If a dependency isn't ready, the ticket is blocked — not faked.
2. **Test against the real platform.** Unit/integration tests run against **Miniflare** (the real Cloudflare Workers runtime locally) with real D1/R2/KV/Queues/AI/Vectorize bindings — not mocked platform APIs. E2E via Playwright against local Workers.
3. **DRY via shared Nx libraries.** All domain logic, DB access, auth, i18n, UI, server functions, and integrations live once in `libs/*` and are consumed by all three apps. Duplication across apps is a defect.
4. **Strict component/logic separation.** Enforced by **Nx project tags + boundary lint rules**, not just convention (see §5). Components never import server functions, DB, or Drizzle. The data flow is one-directional.
5. **Security by default.** Every input validated (Zod), every state-changing endpoint rate-limited (**Durable Object + WAF — never KV**) and Turnstile-protected, every authz check centralized, secrets only in Cloudflare Secrets/`wrangler secret`.
6. **Type safety end-to-end.** Zod schemas are the single source of truth; types are inferred. Server functions carry typed input/output. Cloudflare bindings are typed via `wrangler types`.
7. **Production-grade from ticket #1.** Observability, error envelopes, and tests are part of each feature ticket's DoD — never a later phase.
8. **Sequence over speed.** P1 ships live before P2 work begins in earnest. Payments stay manual in Year 1 (P4 automates).

---

## 2. Locked technology radar

**Compute & platform (Cloudflare, single vendor):**
- **Workers** — runtime for all 3 apps + jobs worker.
- **D1** — primary DB (primary located near Maghreb; Smart Placement enabled).
- **R2** — object storage (uploads).
- **Cloudflare Images** — on-the-fly transforms/resizing (paired with R2).
- **Workers KV** — sessions, rate-limit counters, feature-flag cache, hot config.
- **Queues + Cron Triggers** — async jobs (notifications, reminders, reconciliation nudges).
- **Durable Objects** — real-time strong-consistency state (RSVP/capacity counters, live leaderboards).
- **Workflows** — durable multi-step orchestration (challenge lifecycle, manual-payment reconciliation, sponsor onboarding).
- **Workers AI** — moderation, embeddings, summaries.
- **Vectorize** — semantic search index (events, challenges).
- **Browser Rendering** — OG image generation, PDF receipts.
- **Turnstile** — bot/abuse protection on all forms.
- **Cloudflare Access (Zero Trust)** — gates `apps/admin` to the team.
- **Cloudflare Email (native)** — transactional send (auto SPF/DKIM/DMARC).
- **Analytics Engine + Web Analytics** — product metrics + privacy analytics.
- **Secrets Store / `wrangler secret`** — secrets.
- **PWA Builder** — wraps `apps/ui` for App Store / Play Store.

**Application (TanStack + UI):**
- **TanStack Start** (fullstack SSR + server functions), **Router** (typed routing), **Query** (server state), **Form** (typed forms), **Table** (data grids), **Virtual** (long lists), **Store** (client UI state), **Config** (monorepo build/test/lint).
- **Tailwind CSS v4 + DaisyUI** — styling + component theme.
- **Drizzle ORM** — schema, migrations, queries (portable to Postgres).
- **Better Auth** — authentication (email/password + phone OTP; cookie + token).
- **Zod** — validation + type source of truth.
- **React Email** — email templates (reused components, DRY).
- **Vitest + Playwright + Miniflare** — testing.

**Monorepo tooling:** Nx 23, TypeScript 5.9 (strict), ESLint (with boundary enforcement), Prettier, Changeset/release via TanStack Config.

---

## 3. Repository structure

```
apps/
  ui/                  # Public site + PWA (TanStack Start) — anon, SEO/prerendered
  dashboard/           # Founders/hosts/sponsors (TanStack Start) — authenticated
  admin/               # Project owners (TanStack Start) — gated by Cloudflare Access
  worker-jobs/         # Queue + Cron consumers (notifications, reminders, reconciliation)

libs/
  core/                # env, config, Money value object, Result/Error envelope, feature flags, ids
  db/                  # Drizzle schema (all tables), migrations, repositories, D1 helpers
  domain/              # pure business logic per domain (events, challenges, sponsorships, markets, orders, moderation, users)
  auth/                # Better Auth server config + client + RBAC (roles/permissions)
  server-fns/          # TanStack createServerFn definitions per domain (the backend)
  i18n/                # locales (fr-DZ, ar-DZ, …), RTL, fallback, money/date formatting
  ui/                  # design system: Tailwind v4 + DaisyUI theme, shared components
  ai/                  # Workers AI + Vectorize clients (embeddings, search, moderation)
  payments/            # PaymentProvider interface + ManualProvider (Y1) + DZ adapters (P4)
  email/               # Cloudflare Email integration + React Email templates
  observability/       # logging, Analytics Engine metrics, error reporting
  infra/               # wrangler configs, cf-typegen Env types, seeds, Nx tags
```

### 3.1 Per-app internal structure (enforced pattern)

```
apps/<app>/src/
  routes/              # TanStack Router file-based routes (thin: layout + data wiring only)
  features/
    <domain>/          # e.g. events/, challenges/, sponsorships/
      api.ts           # typed calls into libs/server-fns (server calls live here, not in components)
      hooks.ts         # TanStack Query hooks (useEvents, useCreateEvent, …)
      components/      # domain components, organized by domain
      types.ts         # local view types (inferred from Zod where possible)
  components/          # app-level cross-domain shared components (Layout, Nav, AppShell)
  lib/                 # app bootstrap: query client, router context, providers
```

### 3.2 Data-flow contract (one-directional, enforced)

```
Component → hook (TanStack Query) → api.ts → libs/server-fns → libs/domain → libs/db (Drizzle) → D1
```

- **Components** import only: `hooks`, `components`, `libs/ui`, `libs/i18n`. **Never** `server-fns`, `db`, `domain`, or Drizzle.
- **`api.ts`** is the only layer that imports `libs/server-fns`.
- **`hooks.ts`** is the only layer components call.
- Violations are **lint errors**, not warnings (§5).

---

## 4. Cloudflare bindings map (shared, typed)

All bindings are declared per-app in `wrangler.jsonc` and typed once in `libs/infra` (via `wrangler types`), so every app/server-fn uses the same `Env` type.

| Binding | Type | Used for |
|---|---|---|
| `DB` | D1 | Primary relational store |
| `BUCKET` | R2 | Uploads (images, attachments) |
| `IMAGES` | Cloudflare Images | Transforms/resizing |
| `SESSIONS` | KV | Better Auth sessions |
| `RATELIMIT` | KV | Rate-limit counters |
| `FLAGS` | KV | Feature-flag cache |
| `CACHE` | KV | Hot config / market data |
| `NOTIFICATIONS` | Queue | Email/notification jobs |
| `RECONCILE` | Queue + Workflow | Payment confirmation nudges |
| `AI` | Workers AI | Moderation, embeddings, summaries |
| `VECTOR` | Vectorize | Semantic search index |
| `BROWSER` | Browser Rendering | OG images, PDF receipts |
| `ANALYTICS` | Analytics Engine | Product metrics |
| `EMAIL` | Cloudflare Email | Transactional send |
| Turnstile keys | secrets | Bot protection |
| Auth secrets | secrets | Better Auth secret, OTP hashes |

---

## 5. Architecture enforcement (tooling, not just docs)

- **Nx project tags** classify each project: `type:app`, `type:lib`, `domain:events`, `layer:ui`, `layer:server`, `layer:data`, etc.
- **`@nx/eslint-plugin` dependency rules** enforce the data-flow contract:
  - `layer:ui` may not depend on `layer:server`/`layer:data`.
  - `layer:server` may not depend on `layer:ui`.
  - Apps may depend only on `libs/*`, never on sibling `apps/*` (except via published contracts).
- **Import boundaries** prevent a component from importing `libs/db` or `libs/server-fns` directly.
- **CI gate:** boundary violations fail the build. This is what makes the separation real, not aspirational.

---

## 6. Security baseline (applies to every ticket)

- **Authn:** Better Auth (email/password + phone OTP); **sessions in D1 (via Drizzle) — not KV**; token strategy ready for future non-web clients.
- **Authz:** centralized RBAC (`member`, `host`, `sponsor_contact`, `moderator`, `admin`); every server function declares required permission; checked in a single middleware, not ad hoc.
- **Input validation:** every server function validates input with Zod (inferred types reused in `api.ts` + components). No unvalidated input reaches domain/DB.
- **Bot protection:** Turnstile on signup, login, event creation, RSVP, challenge submission.
- **Rate limiting:** **Durable Object token-bucket** (identity-scoped) + **WAF Rate Limiting** (edge) — not KV (see AGENTS.md §11.5).
- **Admin isolation:** `apps/admin` gated by **Cloudflare Access** + **in-Worker `Cf-Access-Jwt-Assertion` verification** + **`workers.dev` route disabled** (see AGENTS.md §10/§11.5).
- **Secrets:** only in `wrangler secret` / Secrets Store; never committed; `.env` only for local dev with `.env.example` sanitized.
- **Headers/CSP:** Secure-headers middleware; strict CSP (nonces for any inline); HTTPS-only; cookies `Secure; HttpOnly; SameSite=Lax`.
- **Uploads:** R2 presigned/worker-mediated uploads; MIME + size validation; images via Images transforms (no raw HTML injection).
- **OWASP Top-10:** addressed per control in NFR-4; dependency scanning in CI.
- **Platform constraints:** KV eventual consistency, D1 batch-only transactions, DO Alarms for scheduling, provider interfaces for external services — binding rules in AGENTS.md §11.5.

---

## 7. Testing strategy

- **Unit (Vitest):** pure domain logic in `libs/domain` (rules, money math, capacity, scoring).
- **Integration (Vitest + Miniflare):** server functions + repositories against **real local D1/R2/KV/Queues/AI/Vectorize** via Miniflare — no platform mocks.
- **Component (Vitest + Testing Library):** presentational components in isolation.
- **E2E (Playwright):** critical flows per app (signup → create event → RSVP; admin confirms sponsorship; challenge submit → judge → winner).
- **DoD:** every ticket includes or updates tests; coverage gates on `libs/domain` and `libs/server-fns`.

---

## 8. Ticket format

```
#### [P0-001] Title
- Depends on: [IDs]
- Implements: FR-X, NFR-X
- Size: S | M | L
- Acceptance criteria:
  - [ ] …(verifiable)…
- Files: libs/…, apps/…
```

**Definition of Done (every ticket):** real implementation (no stubs); Zod-validated inputs where relevant; tests passing against Miniflare/Playwright; lint + typecheck + boundary checks pass; observability (logs/metrics) for server paths; localized (fr-DZ + ar-DZ) for user-facing strings; documented in code where non-obvious.

---

## 9. Phase P0 — Foundation

> Goal: scaffolded monorepo, all 3 apps + libs, Cloudflare resources provisioned, shared infra real and working. No product features yet.

| ID | Title | Deps | Implements | Size |
|---|---|---|---|---|
| ✅ **P0-001** | Nx workspace + TanStack Config: tsconfig paths, ESLint (with boundary rules §5), Prettier, Vitest base, package scripts | — | NFR-10 | M |
| ✅ **P0-002** | Scaffold `apps/ui` — TanStack Start + `@cloudflare/vite-plugin` + `wrangler.jsonc` + dev/preview/deploy scripts | P0-001 | NFR-12 | M |
| ✅ **P0-003** | Scaffold `apps/dashboard` (same base) | P0-001 | NFR-12 | M |
| ✅ **P0-004** | Scaffold `apps/admin` (same base) + **Cloudflare Access** policy **+ in-Worker `Cf-Access-Jwt-Assertion` JWT verification + disable `workers.dev` route** | P0-001 | FR-M, NFR-4 | M |
| ✅ **P0-005** | `libs/core` — env loader, app config, **Money** value object, Result/Error envelope, id factory, feature-flag reader | P0-001 | §7 (Money), NFR-4 | M |
| ✅ **P0-006** | `libs/db` — Drizzle config, D1 binding helpers, **initial schema** (Market, City, User), migrations via `wrangler d1 migrations`, **atomic-transaction helper** (`db.batch()` + atomic SQL for safe check-then-write) | P0-005 | FR-G1/G2, §7 | M |
| ✅ **P0-007** | Seed D1: DZ (active) + MA (open) markets + major cities | P0-006 | FR-G5, §10.2 | S |
| ✅ **P0-008** | `libs/auth` — Better Auth: **passwordless email-OTP + OAuth (Google/GitHub/LinkedIn) + account linking** + RBAC (member/host/sponsor_contact/moderator/admin); **sessions in D1**, not KV; `EmailProvider` + `DevEmailProvider`; bearer; D1 rate-limiting; **Turnstile verifier + authz middleware** (app mount + admin role layer defer to P1, when D1 is provisioned) | P0-006 | FR-A1/A4/A5 | L |
| ✅ **P0-009** | `libs/i18n` — Paraglide (Arabic-first: `ar`/`en`/`fr`, Latin digits, RTL, fallback chain, money/date/number formatting); pure cookie `detectLocale`. App wiring deferred to P1-017 (needs real localized routes) | P0-001 | FR-L1..L6 | M |
| ✅ **P0-010** | `libs/ui` — Tailwind v4 + DaisyUI v5 "Warm Café" theme (AA-fixed primary) + tokens + `cva` base components (Button, Card, Input, Badge); apps wired to the shared stylesheet. **Modal + Table deferred** to when P1 features need them | P0-009 | NFR-8, NFR-9 | M |
| ✅ **P0-011** | `libs/infra` — `wrangler types` (cf-typegen target per app) → typed `Env`; secrets inventory (docs/secrets.md + .dev.vars.example); resource-naming constants; **R2ImageProvider dev adapter** (real, Miniflare-tested). Prod Images-transform variant → P1 (uploads); tags.ts dropped (dead code — `.mjs` eslint can't import `.ts`) | P0-002 | §4, §5 | S |
| ✅ **P0-012** | `libs/server-fns` scaffold — **hybrid throw boundary** (domain returns `Result`; server-fns unwrap via `handleResult` → throw the typed `AppError`; TanStack Query `error` auto; `appErrorCode` client accessor for the #6428 typing gap); `requestContextMiddleware` (per-request id via P0-014 ALS + failure logging); authz primitives (`checkPermission`/`requireAuth`/`requirePermission`, better-auth RBAC w/ admin wildcards). `authMiddleware`/`requirePermission` middleware instances + `createStart` globals + `createCsrfMiddleware` + Cloudflare `env`-injection (no `getCloudflareContext` in `@cloudflare/vite-plugin` 1.42.3) folded into **P1-017** (apps are placeholders; solved empirically with the real app). Amends AGENTS §5/§7/§11.5/§16 | P0-008, P0-011 | §3.2, NFR-7 | M |
| ✅ **P0-013** | Zod validation convention — `appValidator(schema)` (throws `AppError('validation_failed', {fields})` → P0-012 throw boundary; `.validator(appValidator(schema))` API verified) + shared primitive schemas (`money`/`id`/`pagination`/`marketCode`) in `libs/core`; per-domain schemas land with each domain (P1-005+). Zod 4 declared (was transitive); no `@tanstack/zod-adapter` (Standard-Schema-native). Amends AGENTS §6/§7 | P0-012 | NFR-4 | S |
| ✅ **P0-014** | `libs/observability` — **centralized isomorphic logger** (one `logger` API on Worker + browser): server `console.*`→Workers Logs→Logpush, client beacon→server `ingest`→same stream; AsyncLocalStorage request context; Analytics Engine `createMetrics` (real Miniflare-tested); `reportError` hook; secret/PII `sanitize`. App wiring (client `/client-logs` endpoint + `configureClientLogger` + `reportError` into `onError`/error boundaries) folded into P1-017; `ANALYTICS` binding + Logpush destination at P0-019 | P0-011 | NFR-7 | M |
| **P0-015** | `libs/payments` — `PaymentProvider` interface + **ManualProvider** (Year 1) + Order/Invoice repository + status machine | P0-006 | FR-P3, FR-M5, §8.5 | M |
| **P0-016** | `libs/email` — Cloudflare Email native binding client + React Email template base + render/send pipeline | P0-011 | FR-N1 | M |
| **P0-017** | `libs/ai` — Workers AI client (embeddings, moderation, summarize) + Vectorize index client + reindex helpers; **embeddings enqueued to `worker-jobs` (P0-018) for async generation** (not inline in server-fns) so create flows stay resilient to AI latency | P0-011 | §2 (AI/search) | M |
| **P0-018** | `apps/worker-jobs` — Queue + Cron consumer scaffold (NOTIFICATIONS, RECONCILE, EMBEDDINGS) using Miniflare-real bindings; **explicit Miniflare emulation of Queues + Workflows** | P0-016 | §4 | M |
| **P0-019** | Provision Cloudflare resources — D1, R2 bucket, KV namespaces, Queues, Vectorize index, Turnstile site, Analytics Engine dataset, Email route | P0-011 | §4 | M |
| **P0-020** | CI pipeline — typecheck, lint, boundary checks, unit+integration (Miniflare), e2e (smoke), `wrangler deploy` per app (Workers Builds) | P0-001 | NFR-11, NFR-12 | M |
| **P0-021** | Playwright e2e harness per app + Miniflare integration test harness in `libs/infra`; **auto-migrate + seed D1 in Miniflare before tests** | P0-020 | NFR-11 | M |

**P0 exit criteria:** all 3 apps deploy to Workers; `wrangler dev` runs the full stack locally with real bindings; D1 seeded; CI green; an authenticated "hello world" page per app proves auth + i18n + RTL + logging end-to-end.

---

## 10. Phase P1 — Events engine (ships live)

> Goal: the free events product is in production for DZ (active) + MA (open), with sponsorship surfaces and manual-payment admin. **This is the first real launch.**
>
> **Visual direction:** [`docs/ui-design-spec.md`](./ui-design-spec.md) — the "Warm Café" semantic theme (tokens in `libs/ui`) + the public-feed component patterns consumed by **P1-002** (landing + empty state) and **P1-007** (event list/detail).

| ID | Title | Deps | Implements | Size |
|---|---|---|---|---|
| **P1-001** | `libs/domain/markets` + `libs/server-fns/markets` — read market/city, resolve by host/locale | P0-012 | FR-G3/G4/G6 | M |
| **P1-002** | `apps/ui`: country + city landing pages, locale-prefixed routing, **"be the first host" empty state** | P1-001, P0-010 | FR-E5/E6, FR-L2 | L |
| **P1-003** | Auth UI in `ui` + `dashboard`: signup/login (email + phone OTP), Turnstile, sessions | P0-008, P0-010 | FR-A4, NFR-4 | L |
| **P1-004** | User + host profile (domain, server-fns, UI) with market/city scoping | P0-008, P1-001 | FR-A2/A3, FR-E7 | M |
| **P1-005** | `libs/domain/events` + `libs/db/events` + server-fns: create/list/get with capacity, `is_free`, market scoping | P1-001 | FR-E1/E2/E4 | L |
| **P1-006** | Event create flow in `dashboard` (TanStack Form + Zod + Turnstile) with image upload to R2/Images | P1-003, P1-005 | FR-E1, FR-E9 | L |
| **P1-007** | Event list/detail in `ui` (TanStack Virtual for feeds) + SEO metadata/prerender | P1-005, P0-010 | FR-E5, NFR-1 | L |
| **P1-008** | RSVP flow with **atomic D1 capacity** (`UPDATE … WHERE rsvps < cap` via `db.batch()`) + optimistic UI; **Durable Object only if real-time collaborative state is required** (otherwise atomic SQL suffices) | P1-005 | FR-E3/E4, §11.5 | L |
| **P1-009** | Notifications: Queue producer on RSVP/reminder triggers + `worker-jobs` consumer → Cloudflare Email | P0-016, P0-018 | FR-E8, FR-N1 | M |
| **P1-010** | Anti-no-show commitment flow (confirm attendance) + **event-scheduler Durable Object Alarms** for reminders (alarm set at event creation for `starts_at − 2h`, fires `NOTIFICATIONS` queue; no D1 cron-polling; low-freq cron only as backstop) | P1-009 | FR-E10, §11.5 | M |
| **P1-011** | Sponsorship surfaces: `Sponsor`/`Sponsorship` schema + attach-to-event + **disclosed** rendering in `ui` | P1-005, P0-015 | FR-S1/S2/S3 | M |
| **P1-012** | Sponsor logos via R2/Images + disclosed badge component | P1-011 | FR-S3 | S |
| **P1-013** | `apps/admin`: markets/cities config UI, feature flags, host verification, moderation queue (TanStack Table) | P0-008, P1-005 | FR-M1/M2/M3 | L |
| **P1-014** | `apps/admin`: sponsorship **Order** management + manual **"mark as paid"** (Year 1 payments) + audit log | P0-015, P1-011 | FR-M5, FR-P3 | M |
| **P1-015** | Semantic search over events (Vectorize index + embeddings on create/update) in `ui` | P0-017, P1-005 | §2 (search) | M |
| **P1-016** | `apps/dashboard` host view: manage events + RSVPs (TanStack Table/Virtual) | P1-005, P1-008 | FR-E7 | M |
| **P1-017** | i18n app wiring + parity: `__root` cookie-locale detection (`<html lang dir>`), localize every P1 screen in `ar` (RTL) with fallback; **disable TanStack Start streaming SSR** (the [#6223](https://github.com/TanStack/router/issues/6223) Arabic UTF-8 fix — verify the Start knob or `React.lazy` localized routes). **+ observability app wiring**: client `/client-logs` ingestion endpoint (→ `ingestClientLogs`), `configureClientLogger` bootstrap, `reportError` into `createStart` `onError`/route error boundaries. **+ server-fn app wiring**: `createStart` globals (`requestContextMiddleware`, auth middleware) + `createCsrfMiddleware()`, the Cloudflare `env`-injection mechanism (no `getCloudflareContext` in `@cloudflare/vite-plugin` 1.42.3 — solve empirically), and the `authMiddleware`/`requirePermission` middleware instances (built on P0-012's authz primitives) | P0-009, P0-012, P0-014 | FR-L1..L6, NFR-7, NFR-8 | L |
| **P1-018** | Security hardening pass: **rate limiting via Durable Object + WAF** (not KV) on all create/auth endpoints, CSP, RBAC checks on every server-fn | P0-012 | NFR-4 | M |
| **P1-019** | Observability: Analytics Engine dashboards (events created, RSVPs, density per city/market) + alerts | P0-014 | NFR-7 | M |
| **P1-020** | PWA: web manifest + service worker (`vite-plugin-pwa`), offline shell, prerendered city pages; verify PWA Builder score | P1-002 | D11, NFR-12 | M |
| **P1-021** | E2E suite: signup → create event → RSVP → host view → admin moderation + payment confirmation | P1-013/014 | NFR-11 | M |
| **P1-022** | OG image generation via Browser Rendering for events/cities (social sharing) | P0-011 | §2 (Browser) | S |

**P1 exit criteria (launch):** live in production; Algiers density threshold trending; first sponsorship sold and confirmed manually; e2e green; RTL + PWA verified; PWA Builder packaging succeeds.

---

## 11. Phase P2 — Hackathon engine (epics + anchor tickets)

> **Fully specified in [`docs/hackathon-engine-plan.md`](./hackathon-engine-plan.md)** (tickets `HACK-001`…`HACK-021`). That plan defines the complete engine: lifecycle state machines (Workflow-driven, no cron polling), host create/edit/publish/cancel/pause, registration & eligibility, team formation, submissions (server-side UTC deadlines + AI-disclosure), judging with COI/blind/calibration + weighted aggregation + tie-break, results/leaderboard (Durable Object), prizes & manual payouts (Year 1), integrity/anti-abuse, search/moderation, certificates, and RBAC. The epics below are summaries — **execute P2 via the `HACK-*` tickets** in that document.
>
> Builds the full challenge engine, feature-flagged per market.

- **Epic P2-A: Challenge core** — schema, create (free for students), teams, submissions, judging rubric, leaderboards. Anchors: `[P2-001]` Challenge domain + server-fns (FR-H1/H2/H3/H4/H5); `[P2-002]` Submission pipeline with R2 attachments (FR-H3); `[P2-003]` Judging + scoring + leaderboard (FR-H4/H5).
- **Epic P2-B: Winner payouts (manual)** — winner recording + **Order** (payout) + admin manual confirmation via BaridiMob; PDF receipt via Browser Rendering. Anchors: `[P2-004]` Payout Order + manual confirmation (FR-H6, FR-M5); `[P2-005]` PDF receipt (§2 Browser).
- **Epic P2-C: Real-time leaderboard** — Durable Object for live standings; TanStack Virtual rendering. Anchor: `[P2-006]` Live leaderboard DO.
- **Epic P2-D: Challenge orchestration** — Workflow for challenge lifecycle (draft→live→judging→completed) + reminders. Anchor: `[P2-007]` Challenge Workflow.
- **Epic P2-E: Semantic search + moderation** — Vectorize index over challenges; Workers AI moderation of problem statements/submissions. Anchor: `[P2-008]` Challenge search + moderation (FR-H1, §2).
- **Epic P2-F: Admin + dashboard surfaces** — TanStack Table management, sponsor attachment (FR-H7), moderation queue for submissions. Anchor: `[P2-009]` Challenge admin/dashboard views.

**P2 exit criteria:** first hosted challenge delivered end-to-end; manual payout to a winner completed; feature flag validated (enable/disable per market); e2e green.

---

## 12. Phase P3 — Sponsorship management & talent pipeline (epics)

> **Fully specified in [`docs/sponsorship-measurement-plan.md`](./sponsorship-measurement-plan.md)** (tickets `SP-001`…`SP-017`). That plan defines the measurable value hierarchy (Exposure → Engagement → Acquisition → Talent → Sponsored challenge → Brand lift), the Cloudflare-native attribution pipeline (tracking redirect routes, Analytics Engine, promo codes, dynamic QR, talent attribution), the sponsor dashboard, AI-summarized impact reports, and the privacy/brand-safety guardrails. The epics below are summaries — **execute P3 via the `SP-*` tickets** in that document.

- **Epic P3-A: Sponsor portal (`apps/dashboard`)** — sponsor dashboard across the full measurement hierarchy (FR-S4; see **SP-008**); sponsorship package catalog + self-serve purchase → **Order** (manual confirmation) (FR-S1, §10.3; **SP-015**).
- **Epic P3-B: "Founder Picks"** — categorized disclosed recommendation surface; category sponsorships (FR-S5).
- **Epic P3-C: Talent pipeline** — opt-in participant profiles; warm-intro requests from challenge hosts/funders; consent + privacy controls (FR-P1/P2/P4, NFR-5).
- **Epic P3-D: Sponsor reconciliation** — Workflow for sponsor onboarding + invoice/receipt (Browser Rendering PDF) + manual payment tracking.

**P3 exit criteria:** recurring sponsorship revenue; sponsor dashboard live; ≥1 warm-intro flow completed with consent audit.

---

## 13. Phase P4 — Payments automation + expansion (epics)

- **Epic P4-A: Automate DZ payments** — implement `BaridiMobProvider` + `CibProvider` behind the §8.5 interface; replace ManualProvider confirmation with real charge/payout flows; webhooks; reconciliation Workflow. (Resolves D10.)
- **Epic P4-B: Expand EG** — locale `ar-EG`/`en-EG`; InstaPay/Fawry adapter; activate by density.
- **Epic P4-C: Expand SA** — `ar-SA`/`en-SA`; Mada/STC Pay adapter.
- **Epic P4-D: Expand AE** — `en-AE`/`ar-AE`; AANI/cards adapter; **curation** wedge (saturated market).
- **Epic P4-E: Postgres migration option** — if D1 ceiling approached, stand up Postgres + Hyperdrive; Drizzle swap; data migration script (§8.7 escape hatch).

**P4 exit criteria:** automated payouts live in DZ; at least one new market activated by density; payment abstraction proven across providers.

---

## 14. Cross-cutting workstreams (continuous)

| Workstream | Owner | Cadence |
|---|---|---|
| Security review (OWASP, secrets, authz) | Principal | End of each phase |
| Performance budget (p95 ≤ 300ms on hot paths; NFR-1) | Eng | Per release |
| RTL/i18n parity audit | Eng | Per feature |
| D1 size + query performance monitoring (§8.7 ceiling) | Eng | Monthly |
| Observability/alerting tuning | Eng | Per release |
| Dependency + CVE scan | CI | Every PR |

---

## 15. Risk sequencing (ties to SRS §14)

| Risk | Where mitigated in this plan |
|---|---|
| R-H1 (engine before validation) | P1 ships live before P2; P2 feature-flagged per market; first challenge instrumented (P2 exit) |
| Cold-start / no-show | P1-008 (RSVP DO), P1-010 (commitment + reminders) |
| Ghost-town multi-market | Three-state model; DZ active + MA open only at P1 (P0-007) |
| D1 ceiling | §8.7 escape hatch; P4-E Postgres option; monitoring in §14 |
| Manual-payment drag | Clean Order/Invoice model (P0-015); admin confirmation (P1-014); automate in P4-A |
| Brand dilution | Disclosed-only sponsorships enforced in components (P1-011/012) |
| TanStack Start maturity | Shared libs + strong testing (§7); contained blast radius |
| PWA Builder iOS limits | P1-020 verifies packaging + push early; Capacitor fallback noted |
| Payment regulatory | Year 1 manual limits exposure (§8.5); per-market compliance doc before P4 |

---

## 16. How to run this plan

1. Execute **P0** top-to-bottom (dependencies are ordered). Do not start P1 until P0-021 passes.
2. **P1** is the launch milestone — demo density in Algiers, sell + confirm one sponsorship manually.
3. Hold a **phase-gate review** at each exit: only proceed when exit criteria are met.
4. Refine the next phase's epics into full tickets at each gate (keeps detail fresh).
5. Every PR maps to one ticket ID; every ticket ID maps to `FR-*`/`NFR-*` (traceability SRS ⇄ plan ⇄ code).

---

## Next action
Begin **[P0-001]**. (Or, if you want, I can sync SRS §8.1/§13 with the final integration set decided here — Cloudflare Email, Turnstile, Access, R2+Images, KV, Workers AI, Vectorize, Browser Rendering, Durable Objects, Workflows, Analytics, and TanStack Table/Virtual/Store/Config — so the two docs stay consistent.)
