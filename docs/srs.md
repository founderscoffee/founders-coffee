# Software Requirements Specification (SRS)

## founders.coffee — Multi-market founder community platform

| Field           | Value                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Document        | SRS — founders.coffee                                                                                 |
| Version         | 1.3                                                                                                   |
| Status          | Approved — architecture locked                                                                        |
| Owner           | Founder / Product                                                                                     |
| Last updated    | 2026-08-30                                                                                            |
| Target stack    | Nx monorepo · TanStack Start (fullstack) · Drizzle + Cloudflare D1 · Better Auth · Cloudflare Workers |
| Source research | Market validation sessions (Algeria + MENA) — see Appendix A                                          |

> **How to read this document.** Sections 1–4 are product/business context. Sections 5–9 are the requirements (Functional, Non-functional, Data, Architecture, UX) with stable IDs (`FR-*`, `NFR-*`) for traceability into the implementation plan. Sections 10–14 cover configuration, extensibility guardrails, compliance, risks, and decisions. Everything needed to produce a detailed implementation plan should be derivable from this document.

---

## 1. Product vision

### 1.1 What we are building

**founders.coffee** is a **community business**: an informal, "no formalities" platform where local founders, builders, and students meet over coffee to discover their ecosystem, find collaborators, and grow together. It is composed of three reinforcing layers:

1. **Local events (free)** — anyone hosts a casual coffee meetup at a local café; anyone joins. The acquisition engine and the cultural core.
2. **Online hackathons / challenges** — a community-positive engagement layer (free for students) and a monetizable surface (paid hosted challenges for founders/companies/sponsors).
3. **Sponsorships & partnerships** — the primary revenue.

### 1.2 Brand principles (non-negotiable)

- **"No formalities."** Informal, warm, low-stakes. The brand is anti-corporate, anti-pitch-deck.
- **Community participation stays free.** Membership, events, participation, and ordinary community hosting are always free. Sponsors and organizations—including a founder acting as a commercial challenge client—may pay for clearly separated B2B services.
- **Community adds value; it is not mined.** We monetize _access to_ the community through sponsorships and challenges, never through transactional fees on members.

### 1.3 Why this, why now (condensed)

- **Strong cultural fit in the Maghreb:** Algeria has a centuries-old café culture (Algiers alone: ~1,833 cafés, ~478 specialty). Coffee is already the default venue for informal business talk.
- **Real gap:** No dominant Algeria-native, self-serve, online, locally-payable founder-community/hackathon platform exists. Incumbents (`hackathon.dz`, `Soolvit`) are enterprise/B2B sales tools, not open community marketplaces. The UAE/Saudi gap is _different_ (saturation + curation), not the same.
- **Government tailwinds:** Algeria's Startup Law (4-year corporate-tax exemption for labelled startups, 30% R&D/open-innovation tax allowance capped at 200M DZD), the Startup Fund, Algeria Venture, and the "1,000 Tech Startups" program.
- **Demographics:** ~46.8M population, ~79.5% internet penetration, 118% mobile connections, median age ~29.

(Full market data in Appendix A. Figures are directional and must be re-validated before launch.)

---

## 2. Business goals & success criteria

### 2.1 Primary business goals

1. **Achieve local community density in Algiers** before any monetization or expansion. Density is the only moat.
2. **Validate the free events wedge** as a low-cost, multi-market demand sensor.
3. **Generate B2B revenue** through disclosed sponsorships and paid hosted challenges without charging community members for ordinary participation or hosting.
4. **Remain architecturally ready** to expand beyond Algeria without rewriting the platform. Egypt and Saudi Arabia are open self-serve markets; Morocco and the UAE remain dark until geography and operational readiness are complete.

### 2.2 Success metrics (density-gated)

Activation of a market and of monetized features is **gated by density thresholds**, not by ambition. The operating threshold is:

| Gate                                | Threshold                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Market: `dark` → `open`             | Architecture/config ready; landing page published; no active seeding.                                                                                  |
| Market: `open` → `active`           | **≥ 8 completed events/month for 3 consecutive months, ≥ 3 recurring hosts, and host retention ≥ 60%.**                                                |
| Activate **hackathons** in a market | Market is `active` **AND** `hackathons` feature flag on **AND** the first real challenge is instrumented (payments still manual in Year 1 — see §8.5). |
| Expand operational investment       | The candidate market meets the same density gate and has moderation and operational readiness.                                                         |

### 2.3 Explicit non-goals (MVP)

- We are **not** building a global Devpost competitor.
- We are **not** charging for membership, community events, participation, or ordinary hosting. Commercial clients may pay for explicitly commissioned B2B services.
- We are **not** operating/seeding all target markets at launch (architecture everywhere; operation in one).
- We are **not** running transactional recruiting/placements. (A community-positive talent pipeline via the challenge funnel is in scope; transactional recruiting is out.)
- We are **not** doing cross-border payments; all money flows are strictly in-market, in-currency.
- We are **not** automating payments in Year 1 — payments are **recorded but executed manually** (§8.5).

---

## 3. Stakeholders & personas

| Persona                   | Description                                                                                               | Core need                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Founder / Builder**     | Local entrepreneur, developer, student builder                                                            | Belong to a trusted local community; meet collaborators; learn; win/join challenges. Community participation is free.                                                                               |
| **Host**                  | A founder or community lead who creates a coffee meetup or challenge                                      | A frictionless way to convene people; visibility; reputation.                                                                                                                                       |
| **Participant**           | Attends events / joins challenges                                                                         | Discover nearby relevant events; RSVP; participate; (later) win local-currency prizes.                                                                                                              |
| **Sponsor**               | Telco, bank, labelled startup, ecosystem funder                                                           | Trusted, repeated reach into young local builders; (later) talent/brand outcomes. Pays.                                                                                                             |
| **Challenge host (paid)** | A funded founder, company, or (rarely) investor who runs a challenge to source talent or validate an idea | A vetted pool of local builders + a platform to run the challenge + local payouts. Pays a flat fee.                                                                                                 |
| **Project owner / Admin** | Internal team running founders.coffee                                                                     | Manage market configuration and flags, vet hosts, moderate content, configure sponsorships, and reconcile manual payments. State/city dataset changes remain code-reviewed. Served by `apps/admin`. |

---

## 4. Scope & phased delivery

### 4.1 Phase summary

The two core engines are **both built as real software** (no manual validation phases). They are **staged**: the events engine ships live first, then the hackathon engine, so the platform has real users and revenue runway before the second engine lands.

| Phase                                    | Scope                                                                                                                                                                                                                     | Exit criteria                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **P0 — Foundation**                      | Multi-market architecture, i18n/RTL, identity (Better Auth), geo model, market config, feature-flag system, payment _abstraction interface_ (no integrations), shared Nx libs scaffolded.                                 | All three apps + shared libs scaffolded; one market (DZ) configured; empty-state UX works.                           |
| **P1 — Events engine (ships live)**      | **Full** events engine for DZ (`active`) plus self-serve EG/SA (`open`): create/list/RSVP, host profiles, city discovery, "be the first host" empty state, notifications, moderation, and disclosed sponsorship surfaces. | **Live in production.** Algiers density threshold met; first sponsorship sold (payment recorded, executed manually). |
| **P2 — Hackathon engine (full)**         | **Full** challenge engine: creation (free for students/community), teams, submissions, judging, leaderboards, winner tracking — behind per-market feature flag. Prize payouts **recorded; executed manually** (Year 1).   | First hosted challenge delivered end-to-end; manual payout to winner completed.                                      |
| **P3 — Sponsorship management & talent** | Sponsor management dashboard, "Founder Picks" surfaces, talent pipeline (warm intros from the challenge funnel).                                                                                                          | Recurring sponsorship revenue; talent intros tracked.                                                                |
| **P4 — Payments automation & expansion** | Wire DZ payment providers behind the abstraction; advance other markets only when geography, operations, compliance, and density gates are satisfied.                                                                     | Automated payouts live in DZ; at least one additional market meets its activation gate.                              |

> **Sequencing principle (updated):** no manual validation phases — both engines are built. But **P1 (events) ships to production before P2 (hackathons)** so the platform gathers real users, data, and revenue while the second engine is built. The hackathon engine is **feature-flagged per market** and its **first real challenge is instrumented as the demand signal** (see Risk R-H1, §14). Payments are **manual for Year 1** and automated in P4.

---

## 5. Functional requirements

Requirement IDs use the prefix `FR`. Each is tagged with phase (`P0`–`P4`) and, where relevant, the market states it applies to.

### 5.1 Multi-market & geography (P0)

- **FR-G1** The system shall model geography as **Market → State → City**. Markets are D1 configuration rows; states and cities are versioned server-side reference datasets.
- **FR-G2** Every user-facing record shall carry `market_code` and, where geographic, `state_code` and `city_code` from creation.
- **FR-G3** A Market shall have a **state**: `dark`, `open`, or `active` (see §10.1). State is admin-configurable.
- **FR-G4** Market state and feature activation shall be data/configuration changes. Adding or correcting state/city reference data requires a reviewed dataset change and deployment until admin-managed geography is implemented.
- **FR-G5** The system shall pre-seed major cities for each configured market.
- **FR-G6** Users shall be able to discover events by city ("near me" / by selection) within an active or open market.

### 5.2 Local events — the free wedge (P1, all markets in `open`/`active` state)

- **FR-E1** Any authenticated user (a _host_) shall be able to create a free local event: title, description, venue (café/coworking), date/time (in the city's timezone), capacity, language, category.
- **FR-E2** All events shall be **free** (`is_free = true`). Paid events/tickets are out of scope.
- **FR-E3** Any authenticated user shall be able to **RSVP** to an event and cancel.
- **FR-E4** The system shall enforce capacity and show remaining seats.
- **FR-E5** Each city landing page shall display that city's upcoming events.
- **FR-E6** **Empty-state UX:** a city with no events shall invite the visitor to become the first host ("Be the first to host a founders.coffee in {city}"). It must never appear "dead."
- **FR-E7** Hosts shall have a public profile showing their hosted events (reputation).
- **FR-E8** The system shall send notifications: RSVP confirmations, reminders before the event, host notifications on new RSVPs.
- **FR-E9** Events shall support tagging the spoken/written language (user-generated content is not auto-translated).
- **FR-E10** (Anti-no-show) The system shall use timely reminders and effortless cancellation to reduce no-shows. RSVP remains immediate and shall not require a seat hold, vow, or second confirmation.

### 5.3 Online hackathons / challenges (P2, gated)

> Gated by: market state = `active` **AND** `hackathons` feature flag on. Free for students/community; paid for hosted challenges. Prize payouts are recorded and executed manually in Year 1.

- **FR-H1** Any authorized user shall be able to **create a challenge**: problem statement, rules, timeline, judging criteria, prize (Money, local currency), eligibility.
- **FR-H2** Challenges shall be **free to create** for students/community (acquisition). Paid "hosted challenges" are a separate B2B flow (see §5.5).
- **FR-H3** Participants shall be able to **register, form/join teams, and submit** entries (link/repo/text/media).
- **FR-H4** The system shall support **judging**: rubric-based scoring by assigned judges, with conflict-of-interest handling.
- **FR-H5** The system shall display **leaderboards / results** and winner(s).
- **FR-H6** Winners shall be owed **prize payouts in the local currency**. In Year 1 the payout is **recorded in-system and executed manually** (e.g., BaridiMob push); the local-currency payout remains the core differentiator vs global platforms.
- **FR-H7** The system shall support sponsor attachment to a challenge (branding, prize funding) — see §5.4.
- **FR-H8** A challenge shall be **scoped to a market** (in-market participants, in-currency prizes). Cross-market challenges are out of scope.

### 5.4 Sponsorships & partnerships (surfaces in P1, management in P3)

- **FR-S1** The system shall support configurable **sponsorship packages** (see §10.3 for the catalog and indicative pricing).
- **FR-S2** A sponsor shall be attachable to: a city/event series ("Coffee Series Sponsor"), a single event, a challenge, or a "Founder Picks" category.
- **FR-S3** Sponsored surfaces shall be **clearly disclosed** (brand integrity rule: the "no formalities" trust must not be violated).
- **FR-S4** Sponsors shall have a dashboard (in `apps/dashboard`) showing reach/engagement metrics (events sponsored, builders reached, RSVPs).
- **FR-S5** "Founder Picks" shall be a categorized recommendation surface (tools/services/venues) where sponsorship is disclosed, never deceptive.

### 5.5 Paid hosted challenges & talent pipeline (P2/P3)

- **FR-P1** A commercial client (company, sponsor, fund, or founder acting in a business-client capacity) shall be able to commission a hosted challenge to **source talent or validate an idea**, paying a flat fee.
- **FR-P2** The system shall capture the challenge host's intent (e.g., "find a technical co-founder", "validate concept", "brand + hiring").
- **FR-P3** Collection of the hosted-challenge service fee shall be **recorded as an Order** and, in Year 1, **confirmed manually** by an admin after external payment. The generic `host_fee` purpose is deprecated because it is ambiguous and must not be used for ordinary community hosting.
- **FR-P4** (Community-positive talent) The system shall enable **warm introductions** between challenge participants and interested hosts/funders, with explicit participant opt-in. This is **not** transactional recruiting and must feel organic.

### 5.6 Identity & accounts (P0)

- **FR-A1** The system shall maintain **one global user identity** per person (a user may relocate/travel).
- **FR-A2** Activity and reputation shall be **scoped per market/city** (e.g., a host's Algiers history vs. a Cairo attendance history).
- **FR-A3** Each user shall have changeable `home_market_code`, `home_state_code`, and `home_city_code` values.
- **FR-A4** Authentication shall be **passwordless**: **phone-OTP via SMS** (primary; Twilio Verify) plus **email-OTP** (secondary/billing) plus **OAuth** (Google, GitHub, LinkedIn). Phone-OTP is the primary login method for mobile-first Maghreb markets (118% mobile connections, DZ). Email-OTP remains for OAuth account linking, billing receipts, and users without phone access. OAuth accounts link to a single identity by verified email (account linking enabled, trusted providers only). No passwords.
- **FR-A5** Roles: `member`, `host` (a member who has hosted), `sponsor_contact`, `admin`, `moderator`.

### 5.7 Internationalization & localization (P0)

- **FR-L1** All user-facing strings shall be **externalized** to locale resources. Zero hardcoded copy.
- **FR-L2** The UI shall support **right-to-left (RTL) and left-to-right (LTR)** layout driven by the active locale/market direction.
- **FR-L3** The system shall use a **locale fallback chain** ending at the base locale `ar` (e.g., `fr → ar`, `en → ar`) so partial translations degrade gracefully.
- **FR-L4** Dates, times, numbers, and currencies shall be formatted per the active locale and the relevant timezone.
- **FR-L5** User-generated content shall be tagged with a language code and **not auto-translated**.
- **FR-L6** The default locale for a market is determined by `Market.default_locale`.

### 5.8 Admin & moderation (P0/P1) — served by `apps/admin`

- **FR-M1** Project owners (admins) shall be able to configure D1-backed market state, feature flags, payment confirmation, and brand overrides without deploys. State/city reference data remains versioned code until a separately approved admin-geography feature exists.
- **FR-M2** Moderators shall be able to review/remove events, challenges, and user-generated content, with **language/region awareness** (a market's content is moderated by someone fluent in its language/culture).
- **FR-M3** The system shall support host verification (light trust mechanism) to reduce spam/abuse without adding formality.
- **FR-M4** The system shall log moderation + payment-confirmation actions for audit.
- **FR-M5** Admins shall be able to **confirm manual payments** ("mark as paid") for sponsorship orders, hosted-challenge fees, and prize payouts (Year 1 flow, §8.5).

### 5.9 Notifications & communications (P1)

- **FR-N1** Event notifications shall use **PWA web push (FCM)** as the primary channel for subscribed devices and **Twilio Programmable SMS** as fallback. Email remains the authentication, billing, and explicitly-email channel. Twilio Verify is used only for phone authentication.
- **FR-N2** Notification preferences shall be user-configurable.
- **FR-N3** Notifications shall be localized.

---

## 6. Non-functional requirements

| ID         | Category             | Requirement                                                                                                                                                                                                                                                       |
| ---------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NFR-1**  | Performance          | Event listing/detail server functions shall respond ≤ 300ms (p95) at MVP load.                                                                                                                                                                                    |
| **NFR-2**  | Scalability          | Stateless Workers (auto-scaling edge); no single-market coupling in hot paths. See §8.7 for the D1 data-scale ceiling and escape hatches.                                                                                                                         |
| **NFR-3**  | Availability         | MVP target: 99.5% uptime; graceful degradation if a payment provider or external service is unavailable.                                                                                                                                                          |
| **NFR-4**  | Security             | OWASP top-10 controls; input validation at the server-function layer (Zod); secrets via Wrangler env/Cloudflare secrets, never in repo; rate limiting on auth and create endpoints.                                                                               |
| **NFR-5**  | Privacy              | Minimal PII collection; explicit consent for talent-pipeline opt-in (FR-P4); data export/retention policy per market.                                                                                                                                             |
| **NFR-6**  | Compliance           | Payment flows must comply with each market's regulator (Algeria: Bank of Algeria / postal regulations; MA: post-CMI-liberalization rules; EG: CBE; SA: SAMA; AE: ADGM/CBUAE). No cross-border money movement. Year 1 manual execution limits regulatory exposure. |
| **NFR-7**  | Observability        | Structured logging, request tracing, metrics (events created, RSVPs, density per city/market), alerting on payment-confirmation backlog. Cloudflare observability enabled.                                                                                        |
| **NFR-8**  | Accessibility        | Frontend shall meet WCAG 2.1 AA, validated in both LTR and RTL.                                                                                                                                                                                                   |
| **NFR-9**  | Internationalization | All features must work correctly under RTL and for multi-currency/multi-timezone without code branches per market.                                                                                                                                                |
| **NFR-10** | Maintainability      | Strict TypeScript; clean Nx library boundaries; adding a market or payment provider must not touch unrelated modules.                                                                                                                                             |
| **NFR-11** | Testability          | Unit tests for domain logic (Vitest/Jest); e2e for critical flows (events RSVP, challenge judging + payout confirmation).                                                                                                                                         |
| **NFR-12** | Deployability        | Each app deploys to Cloudflare Workers via Wrangler (`wrangler deploy`); buildable via Nx/Vite targets.                                                                                                                                                           |

---

## 7. Data model (conceptual)

Storage: **Cloudflare D1** (SQLite-based, edge). ORM: **Drizzle** (portable to Postgres — the Year-2+ escape hatch, §8.7).

```
Market (D1)
  code (DZ | MA | EG | SA | AE), name, slug
  default_locale, default_currency, timezone, direction (rtl|ltr)
  state (dark | open | active)
  feature_flags { events, hackathons, payments, recruiting }
  payment_providers[]            // empty until P4 wiring
  brand_overrides {}             // accent color, tagline key, etc.

GeoState / GeoCity (versioned server-side reference data)
  market_code, state_code, city_code, names, slug, featured

User
  global identity; email/phone; role; home_market_code; home_state_code; home_city_code; locale_pref
  // talent opt-in flag (FR-P4)

Event
  id, market_code, state_code, city_code, host_user_id
  title, description, venue, starts_at, capacity, language, category
  rsvps (denormalized counter), is_free = true
  latitude, longitude, venue_address
  sponsorships[]                 // sponsor surfaces attached (FR-S2)
  // reserved-for-later (P2+): challenge_id, prize (Money)

EventRsvp
  event_id, user_id              // UNIQUE(event_id, user_id) — idempotent RSVP
  status (confirmed | cancelled)
  created_at

ScheduledNotification
  id, event_id, user_id
  channel (push | sms | email), template_key
  payload (JSON), status (pending | sent | failed)
  send_at (unix timestamp), created_at
  // Event alarms enqueue due work; a low-frequency sweep only recovers missed alarms.

PushSubscription                (PWA web push via FCM HTTP v1)
  id, user_id, token (device token or FCM web push token)
  platform (web), surface (pwa), market_code
  created_at, updated_at
  // Multiple tokens per user (multiple devices); invalidated on logout or DeviceNotRegistered

Challenge
  id, market_code, host_user_id (or sponsor_id), commercial_client_id?
  problem, rules, timeline, judging_criteria, prize (Money), currency
  participants[], teams[], submissions[], judges[], winners[]
  status (draft | live | judging | completed)

Sponsor
  id, name, logo, markets[], package_type, surfaces[]

Sponsorship
  sponsor_id, surface (series | event | challenge | founder_picks_category)
  market_code, start_date, end_date, disclosure_text

Order / Invoice   (Year 1: manual payments)
  id, market_code, type (sponsorship | hosted_challenge_fee | prize_payout)
  amount (Money), currency, status (pending | paid | refunded | failed)
  payer_ref, payee_ref, due_date, paid_at
  confirmed_by_admin_id         // who marked it paid (FR-M5)
  external_ref                  // bank transfer / BaridiMob txn id, entered manually
  // Year 1: NO provider integration. Admin confirms after external payment.

PaymentRecord   (P4+: populated when providers are wired)
  id, market_code, provider_code, type (collection | payout)
  amount_minor (int), currency, status, ref (order_id / user_id)

Money (value object, used everywhere — never bare numbers)
  amount_minor: int   // minor units (e.g., centimes)
  currency: string    // ISO 4217 (DZD, MAD, EGP, SAR, AED)
```

**Rule:** monetary values are always `{ amount_minor, currency }`. Never store or pass a bare number for money. In Year 1, money is _recorded and confirmed manually_; no automated provider calls exist.

---

## 8. Architecture & technical constraints

### 8.1 Stack (locked)

- **Monorepo:** Nx 23, npm workspaces (`apps/*`, `libs/*`); **TanStack Config** for shared build/test/lint/release.
- **Apps (frontend + backend):** **TanStack Start** (fullstack: SSR + typed server functions) — `apps/ui`, `apps/dashboard`, `apps/admin`; plus `apps/worker-jobs` for Queue/Cron consumers.
- **TanStack toolset:** **Router**, **Query** (server state), **Form** (typed forms), **Table** (data grids), **Virtual** (long lists), **Store** (client UI state).
- **Styling/UI:** **Tailwind CSS v4 + DaisyUI** (shared design system in `libs/ui`).
- **Validation:** **Zod** (single source of truth; types inferred and reused across layers).
- **Runtime:** **Cloudflare Workers** (edge, global); **Smart Placement** keeps compute near the D1 primary. No gateway, no NestJS, no Containers at MVP (see §8.7).
- **Database:** **Cloudflare D1** (SQLite, edge), primary near the Maghreb; **Drizzle** ORM (portable to Postgres).
- **Storage & media:** **R2** (uploads) + **Cloudflare Images** (transforms/resizing).
- **Cache & state:** **Workers KV** for feature-flag cache, hot configuration, and idempotent reads only. Sessions live in D1; rate limiting uses Durable Objects + WAF. Durable Objects also support real-time coordination and per-entity alarms.
- **Async & orchestration:** **Durable Object alarms → Workers Queues** for per-entity reminders; low-frequency Cron only as a recovery sweep. **Workflows** handle durable multi-step processes such as challenge lifecycle and sponsor onboarding.
- **AI & search:** **Workers AI** (moderation, embeddings, summaries) + **Vectorize** (semantic search over events/challenges).
- **Email:** **Cloudflare Email** (native; auto SPF/DKIM/DMARC) with **React Email** templates.
- **Rendering:** **Browser Rendering** (OG images for social sharing, PDF receipts).
- **Security:** **Turnstile** (bot protection on all forms); **Cloudflare Access / Zero Trust** (gates `apps/admin` to the team).
- **Observability:** **Analytics Engine** (product metrics) + **Web Analytics** (privacy analytics); structured logging.
- **Secrets:** **Cloudflare Secrets Store / `wrangler secret`**.
- **Auth:** **Better Auth** — passwordless phone-OTP (Twilio Verify, primary) + email-OTP (secondary/billing) + OAuth (Google, GitHub, LinkedIn); account linking; cookie (web) + bearer token (future non-web); sessions in D1 (not KV).
- **Mobile:** `apps/ui` is an installable Serwist PWA. PWA Builder may package that same PWA for stores; a separate native app is not committed scope.
- **Testing:** **Vitest** + **Playwright** against **Miniflare** (real local Cloudflare bindings — no platform mocks).
- **Language:** TypeScript 6, strict.

### 8.2 App topology (clean separation from day 1)

Three independent, fullstack TanStack Start apps (each its own Worker) + a dedicated jobs worker, all sharing the same core via Nx libs:

| App                    | Audience                                                   | Role                                                                                                                                                                                               | Notes                                                                                   |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **`apps/ui`**          | Public                                                     | The community site: events discovery, city landing pages, host profiles, SEO/prerendered, the "be the first host" empty state. **This is the installable PWA**; PWA Builder packaging is optional. | Anon-accessible; heavily prerendered.                                                   |
| **`apps/dashboard`**   | Sponsors (authenticated)                                   | Sponsorship account management, analytics, reporting, and commercial challenge commissioning.                                                                                                      | Authenticated, dynamic; no member/host event workflows.                                 |
| **`apps/admin`**       | Project owners / internal team (authenticated, privileged) | D1-backed market config, feature flags, moderation queue, host verification, **manual payment confirmation** (Year 1), sponsorship management.                                                     | Strictly separated; gated by **Cloudflare Access**; privileged code never ships public. |
| **`apps/worker-jobs`** | System (no UI)                                             | Queue consumers for notifications and AI reindexing plus coarse recovery/reconciliation jobs. Per-entity timing originates in Durable Object alarms.                                               | Consumes Queues and recovery Cron; shares `libs/*`.                                     |

**Shared Nx libraries** (written once, consumed by all apps' server functions):

```
libs/
  core/            // env, config, Money value object, Result/Error, feature-flags, ids
  db/              // Drizzle schema (all tables), migrations, repositories, D1 helpers
  domain/          // pure business logic: events, challenges, sponsorships, markets, orders, moderation, users
  auth/            // Better Auth server config + client + RBAC
  server-fns/      // TanStack createServerFn definitions per domain (the backend)
  i18n/            // locales, RTL, fallback, money/date formatting
  ui/              // Tailwind v4 + DaisyUI design system, shared components
  notifications/   // PWA push and notification-SMS delivery providers
  payments/        // PaymentProvider interface + ManualProvider (Y1) + DZ adapters (P4)
  email/           // Cloudflare Email integration + React Email templates
  observability/   // logging, Analytics Engine metrics, error reporting
  infra/           // wrangler configs, typed Env (cf-typegen), seeds, Nx tags
```

Server-only Workers AI and Vectorize ports live at `libs/core/src/ai` and are exported through `@founders-coffee/core/ai`.

> Why no gateway? With TanStack Start fullstack, **server functions are the backend** and call D1 directly via Drizzle. The PWA is the same JavaScript client. Extract a dedicated API only if a genuinely separate client or external integration requires one (§8.7).

### 8.3 Fullstack execution model

- Each app's **server functions** (`createServerFn`) run on the Worker, import shared `domain`/`db` logic, and read/write **D1** via the `env.DB` binding (Drizzle).
- The browser calls typed server functions; it never touches D1 directly. End-to-end type safety with no REST boundary.
- Async jobs run in `apps/worker-jobs`. Queues carry asynchronous work; Durable Object alarms schedule per-entity work; Cron is limited to recovery and coarse operational jobs.

### 8.4 Multi-market architecture rules

- **Single D1 database, `market_code` foreign-key column** (not separate tenants). No multi-tenant isolation.
- **Feature flags per market** drive which engines are active where (e.g., challenges only where `feature_flags.hackathons === true`).
- **Per-market configuration** (locale, currency, timezone, direction, brand) is data-driven, not hardcoded.

### 8.5 Payment handling — manual in Year 1, automated in P4

- **Abstraction defined now, no adapters wired in Year 1:**
  ```
  interface PaymentProvider {
    marketCode: string;
    charge(input: ChargeInput): Promise<ChargeResult>;   // collections (commercial client pays us)
    payout(input: PayoutInput): Promise<PayoutResult>;   // payouts (we pay winners, in-currency)
    status(id: string): Promise<PaymentStatus>;
  }
  ```
- **Year 1 (P1–P3):** money is recorded as `Order`/`Invoice` rows; an admin **confirms payment manually** in `apps/admin` ("mark as paid") after an external bank transfer / BaridiMob push. No provider calls, no webhooks, no merchant-of-record.
- **P4:** implement DZ adapters (`BaridiMobProvider`, `CibProvider`) behind the same interface, replacing manual confirmation with automated flows. Later markets (MA/EG/SA/AE) wire their own adapters.
- Collections and payouts are modeled as **separate flows** (different regulators).

### 8.6 i18n / RTL architecture

- **Language-level locales** (not region variants): **`ar`** (a single Modern Standard Arabic used for _all_ Arabic markets), **`en`**, **`fr`**. Shared via `libs/i18n`.
- **Arabic-first**: supported locales are **`ar`**, **`fr`**, and **`en`**. `ar` is the base and final fallback.
- Messages via **Paraglide** (compile-time, type-safe); formatting via native **`Intl.*`** (full ICU on Workers, no flags). **Latin digits forced** across all locales (`numberingSystem: latn`).
- Direction (`rtl`/`ltr`) is a first-class property of the active locale; every screen is built and tested in both directions from P0.
- Locale fallback chain ends at the base locale `ar` (`fr → ar`, `en → ar`), so partial translations never break the UI.
- Cookie-based locale (clean URLs, no locale prefix). Resolution is user preference/cookie → market default → `ar`; browser `Accept-Language` does not override it.

### 8.7 Scaling & growth limits (the honest ceilings)

| Dimension                  | Status          | Ceiling / plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request/traffic volume** | ✅ Excellent    | Workers auto-scales globally; not a concern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Geographic latency**     | ✅ Excellent    | Edge POPs + D1 read replicas; a strength for multi-market.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Write throughput**       | ✅ Fine         | Community events app is low-write; single-primary D1 is adequate.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Data volume**            | ⚠️ Real ceiling | D1 caps each database at **~10 GB, no auto-sharding**. Escape hatches (Year-2+ only — not at MVP): (a) **migrate to Postgres via Drizzle** (preferred — preserves joins; via Hyperdrive); (b) **shard one-D1-per-market**, ideally **hybrid** (global D1 for User/Market/Auth + per-market D1s for events/orders) — note cross-D1 joins are impossible (app-level joins), so Postgres is usually cleaner. State/city reference datasets remain versioned code unless separately redesigned. Set the D1 primary near Maghreb. |
| **Team / codebase**        | 🟡 Small→medium | Shared-libs fullstack works to a small-medium team. At large-org scale, extract a dedicated API (the gateway) — a normal refactor, not a rewrite.                                                                                                                                                                                                                                                                                                                                                                            |
| **Containers**             | 🟡 Deferred     | Add only if a job needs a Node-only library (e.g., a payment SDK, headless browser). Otherwise Queues/Cron suffice.                                                                                                                                                                                                                                                                                                                                                                                                          |

**Scaling philosophy:** the architecture scales comfortably past the point where the business is proven. Scale is not the current risk — validated users are. The escape hatches above are incremental (swap DB, extract a service), never a rewrite.

---

## 9. UX requirements

- **FR-L2 governs:** every screen must be designed and tested in both RTL and LTR.
- **Market landing pages** use configured market slugs (`/algeria`, `/egypt`, …) with local language, local cities/events, and local brand accents.
- **"Be the first host" empty states** for any city with no events — emptiness reads as invitation, not abandonment (FR-E6).
- **No-formalities tone** in all copy: warm, plain, anti-corporate. No "prestige", "elite", "exclusive" language.
- **Disclosed sponsorships only** — a sponsored surface must be visibly labeled; never covert (FR-S3, brand integrity).
- **Frictionless hosting** — creating an event must take minutes, from a café table.
- **Admin (`apps/admin`) UX** is utility-first (operations console), exempt from the public "no-formalities" marketing tone, but still clean and accessible.

---

## 10. Market configuration

### 10.1 Market states

| State      | Visible?         | Seeded/Market?                                              | Used for                                                     |
| ---------- | ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| **dark**   | No               | No                                                          | Future markets — exists in code/data only.                   |
| **open**   | Yes (self-serve) | No                                                          | Anyone can post; we do not invest. Reads demand. (EG and SA) |
| **active** | Yes              | Yes (host recruitment, marketing, partnerships, moderation) | Full operational investment. (e.g., DZ at launch)            |

### 10.2 Per-market configuration (target end-state)

| Market | Default locale    | Direction | Currency | Timezone          | Payment rails (P4)                   | Launch state |
| ------ | ----------------- | --------- | -------- | ----------------- | ------------------------------------ | ------------ |
| 🇩🇿 DZ  | `ar` (+`fr`,`en`) | rtl       | DZD      | Africa/Algiers    | BaridiMob, CIB, Edahabia, DZ MOB PAY | **active**   |
| 🇪🇬 EG  | `ar` (+`en`,`fr`) | rtl       | EGP      | Africa/Cairo      | InstaPay (IPN), Fawry, Vodafone Cash | **open**     |
| 🇸🇦 SA  | `ar` (+`en`,`fr`) | rtl       | SAR      | Asia/Riyadh       | Mada, STC Pay, SARIE, Geidea         | **open**     |
| 🇲🇦 MA  | `ar` (+`fr`,`en`) | rtl       | MAD      | Africa/Casablanca | CMI, PayZone                         | dark         |
| 🇦🇪 AE  | `ar` (+`en`,`fr`) | rtl       | AED      | Asia/Dubai        | AANI, cards, BNPL                    | dark         |

**Expansion rule:** operate DZ first. EG and SA remain self-serve `open`; either advances only after the density gate. MA and AE remain `dark` until geography and operational readiness are complete.

### 10.3 Sponsorship catalog (indicative pricing, DZ)

| Package                              | Description                                                                                            | Indicative price (Y1)            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| **Coffee Series Sponsor** (anchor)   | "founders.coffee Algiers, presented by [brand]"; logo on every event; 1 meet-the-founders slot/quarter | 1.5–3M DZD / year                |
| **The Coffee** (micro-sponsor)       | Sponsors the coffee at every meetup (brand on cups/coaster)                                            | 200–500K DZD / quarter           |
| **Founder Picks** (category sponsor) | Disclosed recommendation in a category (e.g., a SaaS/payment tool)                                     | 300–800K DZD / year per category |
| **Single-event partner**             | One event/mixer branding + hiring booth                                                                | 150–400K DZD / event             |
| **Hosted challenge** (paid, P2)      | Flat fee to commission a talent/idea-validation challenge                                              | 1–3M DZD per challenge           |

(Prices are indicative and must be validated with real sponsor conversations before being committed. Year 1: payment recorded as an Order, confirmed manually by admin.)

---

## 11. Extensibility guardrails (build now vs. defer)

**Build now (cheap, prevents painful rewrites):**

- i18n framework with RTL from line one (FR-L1/L2/L3) in `libs/i18n`.
- `Money` value object used everywhere (NFR-9, §7).
- Payment **abstraction interface** (§8.5) — defined now, **no adapters** in Year 1.
- `market_code` plus `state_code`/`city_code` on geographic records; per-market config + feature flags (FR-G, §8.4).
- Externalized copy; direction-aware layout.
- Timezone-safe date/time handling.
- Drizzle schema in `libs/db` (portable to Postgres).

**Defer (do NOT build now):**

- Payment **provider integrations** (DZ and others) — Year 1 is manual confirmation (§8.5).
- Multi-tenant DB isolation (not needed).
- i18n CMS (static JSON resources suffice until scale).
- Cross-border payments / cross-market challenges.
- Transactional recruiting.
- A dedicated API **gateway** (only if a non-JS client or external integrations appear — §8.7).
- Containers (only if a job needs a Node-only library — §8.7).

---

## 12. Compliance, privacy & trust

- **Payments:** Year 1 manual execution (admin-confirmed bank transfer / BaridiMob) intentionally limits regulatory exposure. Each market's automated collection/payout flow (P4) must comply with its regulator (NFR-6). Document compliance requirements per market before P4.
- **Startup Label (DZ):** Investigate obtaining Algeria's startup label (4-year tax exemption + Startup Fund access) as a structural advantage. (Operational, not software — but flagged here.)
- **Content moderation:** Language/region-aware (FR-M2); a market's content is moderated by a fluent moderator, via `apps/admin`.
- **Talent opt-in:** Explicit, revocable consent for any warm-intro/talent pipeline use of a member's data (FR-P4, NFR-5).
- **Data residency:** Assess per-market requirements during P4 planning.
- **Admin separation:** `apps/admin` is a distinct app so privileged operations and code are isolated from public bundles.

---

## 13. Decisions (resolved)

| #   | Decision                  | Resolution                                                                                                                                                                                     | Rationale                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Database**              | **Cloudflare D1**                                                                                                                                                                              | Edge-native, cheap, fits Workers; primary near Maghreb. Postgres is the Year-2+ escape hatch via Drizzle.                                                                                                                                                                                                                                                                               |
| D2  | **ORM**                   | **Drizzle**                                                                                                                                                                                    | Edge-native (unlike Prisma on Workers); portable to Postgres.                                                                                                                                                                                                                                                                                                                           |
| D3  | **Frontend framework**    | **TanStack Start** (fullstack) + Query, Form, Table, Virtual, Store, Config                                                                                                                    | Typed server functions = the backend; full TanStack toolset; end-to-end type safety; edge-native.                                                                                                                                                                                                                                                                                       |
| D4  | **Auth method**           | **Passwordless** phone-OTP (Twilio Verify, primary) + email-OTP (secondary/billing) + OAuth (Google/GitHub/LinkedIn) via **Better Auth**; account linking (trusted providers, same-email only) | Phone-OTP is the lowest-friction method in mobile-first Maghreb markets (118% mobile connections, Algeria). Email retained for OAuth linking, billing, and fallback. No passwords. One global identity (FR-A1). Sessions in D1 (not KV); D1-backed auth rate limiting. Twilio Verify provides stateless OTP + Fraud Guard. _Amends prior D4 (email-OTP primary) per market validation._ |
| D5  | **Notification channels** | PWA web push via FCM (primary) + Twilio Programmable SMS (fallback) + Cloudflare Email (authentication/billing/explicit email)                                                                 | Keeps event communication immediate while retaining SMS coverage when push is unavailable. Twilio Verify remains authentication-only.                                                                                                                                                                                                                                                   |
| D6  | **Hosting region**        | Cloudflare edge; **D1 primary near Maghreb**                                                                                                                                                   | Latency + data-residency considerations.                                                                                                                                                                                                                                                                                                                                                |
| D7  | **Monetization build**    | **Build sponsorship surfaces in P1; sell through the platform** (no manual-only phase)                                                                                                         | Sponsorship is a built feature of the events engine; no manual validation phase.                                                                                                                                                                                                                                                                                                        |
| D8  | **Hackathon engine**      | **Build the full engine in P2** (no manual validation); ship P1 events first                                                                                                                   | Staged shipping gives real users before P2; first real challenge is the demand signal.                                                                                                                                                                                                                                                                                                  |
| D9  | **Backend architecture**  | **Fullstack TanStack Start; no gateway; retire NestJS**                                                                                                                                        | Single client (the PWA); server functions preserve type safety; no NestJS on Workers.                                                                                                                                                                                                                                                                                                   |
| D10 | **Payments**              | **Manual for Year 1** (record + admin-confirm); automate DZ in P4                                                                                                                              | Payments hardest to automate / easiest to do manually; defers regulatory + integration risk.                                                                                                                                                                                                                                                                                            |
| D11 | **Mobile**                | **Installable Serwist PWA**; optional PWA Builder packaging                                                                                                                                    | One member client and no separate native codebase. React Native/Expo remains research, not committed scope.                                                                                                                                                                                                                                                                             |
| D12 | **App separation**        | **Three apps** (`ui`, `dashboard`, `admin`) + `worker-jobs`                                                                                                                                    | Clean separation + security isolation from day 1; dedicated jobs worker.                                                                                                                                                                                                                                                                                                                |
| D13 | **Email**                 | **Cloudflare Email** (native) + React Email templates                                                                                                                                          | Zero external vendors; native Worker binding; auto SPF/DKIM/DMARC.                                                                                                                                                                                                                                                                                                                      |
| D14 | **Styling / UI**          | **Tailwind CSS v4 + DaisyUI**                                                                                                                                                                  | Shared design system; RTL-aware; fast build.                                                                                                                                                                                                                                                                                                                                            |
| D15 | **AI & search**           | **Workers AI + Vectorize**                                                                                                                                                                     | Semantic search over events/challenges; AI moderation; recommendations.                                                                                                                                                                                                                                                                                                                 |
| D16 | **CF platform services**  | **R2 + Images, KV, Durable Objects, Workflows, Browser Rendering, Turnstile, Access, Analytics Engine**                                                                                        | Single-vendor platform; real-time, orchestration, uploads, security, metrics — all native.                                                                                                                                                                                                                                                                                              |

---

## 14. Risks & mitigations

| Risk                                                                                     | Severity | Mitigation                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R-H1: Hackathon engine built before demand validation** (overriding manual validation) | **High** | (1) Feature-flag per market — cheap to disable if wrong. (2) Ship P1 events first so the platform has real users before P2. (3) **Instrument the first real challenge hard** (host acquisition cost, builder participation, dropout, renewal) — it is the demand test, post-build. |
| **Cold-start / no-show death spiral** (free events → 30–50% no-show → hosts quit)        | High     | Density-first (one city); timely reminders and easy cancellation (FR-E10); hand-recruit first hosts.                                                                                                                                                                               |
| **Ghost-town across markets** (multi-market spread thin)                                 | High     | Three-state model (§10.1); density-gated activation (§2.2); seed only DZ.                                                                                                                                                                                                          |
| **D1 data ceiling** (~10 GB / DB, no auto-sharding)                                      | Medium   | Drizzle→Postgres migration path; per-market D1 sharding option (§8.7).                                                                                                                                                                                                             |
| **Manual-payment operational drag** (Year 1)                                             | Medium   | Clean Order/Invoice model + admin confirmation (FR-M5); automate in P4 behind the existing interface.                                                                                                                                                                              |
| **Brand dilution** (sponsor formality creeps in)                                         | Medium   | Disclosed-only sponsorships; one sponsor per event; organic feel (FR-S3, §9).                                                                                                                                                                                                      |
| **RTL/i18n technical debt**                                                              | Medium   | Build RTL-correct from P0 (FR-L2); shared `libs/i18n`; never defer.                                                                                                                                                                                                                |
| **TanStack Start maturity**                                                              | Medium   | Accept the maturity tax for type safety; mitigate with shared libs + solid testing.                                                                                                                                                                                                |
| **PWA push availability** (permission, installation, browser support)                    | Medium   | Ask contextually, store preferences, and use SMS fallback when no valid push subscription exists.                                                                                                                                                                                  |
| **"Why not just use Devpost/Meetup?"**                                                   | Medium   | Local payouts + local sponsors + local-language community are the differentiators.                                                                                                                                                                                                 |
| **Regulatory change** (e.g., MA CMI liberalization)                                      | Low-Med  | Payment abstraction isolates per-market changes (§8.5).                                                                                                                                                                                                                            |

---

## 15. Glossary

- **Market** — a country configuration. DZ is active; EG/SA are open; MA/AE are dark.
- **City** — a geographic unit within a market where events happen.
- **Market state** — `dark` (not visible), `open` (visible, self-serve, unseeded), `active` (fully operated).
- **Density** — the concentration of active hosts, events, and repeat attendance in a city; the core moat and the activation gate.
- **Hosted challenge** — a paid challenge commissioned by a founder/company to source talent or validate an idea.
- **Founder Picks** — a categorized, disclosed recommendation surface (sponsorable).
- **Money** — a `{ amount_minor, currency }` value object; the only legal representation of money in the system.
- **Order / Invoice** — a recorded payable/receivable; in Year 1 its status is flipped to `paid` by an admin after an external manual payment.
- **Server function** — a TanStack Start function that runs on the Worker (the backend), with typed input/output; calls D1 via Drizzle.

---

## Appendix A — Market research summary (directional)

> Condensed from the validation research. Figures are directional and must be re-validated before launch. Included here so the SRS is self-contained.

**Algeria (launch market)**

- ~46.8M population; ~79.5% internet penetration (37.8M users); 118% mobile connections; ~25.6M social media users; median age ~29.
- Startup ecosystem: ~52 tracked startups, global rank ~#109, +38.7% growth (2025), ~$14.7M+ total funding, **0 unicorns**. ~2,300 labelled startups.
- Payments: ~16% of adults use digital payments (cash-dominated); 22M+ cards; BaridiMob, CIB, Edahabia, DZ MOB PAY. E-payments 939B DZD in 2025 (+46% YoY).
- Developer talent: 17 GDG chapters; ~29% of devs work remotely for foreign firms; local dev salaries ~20K–200K+ DZD/month.
- Culture: centuries-old café culture; Algiers ~1,833 cafés (~478 specialty). Languages: Darija (spoken ~90%) + French (written/business) + code-switching.
- Policy: Startup Law — 4-year corporate-tax exemption; 30% R&D/open-innovation tax allowance (cap 200M DZD); Startup Fund; Algeria Venture; "1,000 Tech Startups".

**Competitive landscape (hackathons/open innovation — DZ)**

- `hackathon.dz`, `Soolvit` (B2B SaaS), Algeria 2.0, Algeria Venture, Algeria Startup Challenge/Leancubator, Sonatrach/Sonelgaz/Saidal in-house challenges. **Gap:** no open, self-serve, online, locally-payable community marketplace.

**Other target markets (expansion)**

- 🇲🇦 Morocco — CMI monopoly ended May 2025; Darija/French near-twin to DZ.
- 🇪🇬 Egypt — InstaPay (IPN, 40M+ users), Fawry; large population.
- 🇸🇦 Saudi — Mada, STC Pay, SARIE; Vision 2030 funding.
- 🇦🇪 UAE — AANI, mature card/BNPL market; **already saturated** community space (Founder Connects, Startup Grind Dubai, LEAP, GITEX) — wedge there is curation, not first-mover.

**Monetization model (B2B, invisible to founders)**

- Sponsorships (primary) + paid hosted challenges (flat fee) + community-positive talent pipeline. Community membership, participation, events, and ordinary hosting remain free; a founder acting as a commercial client may pay for a commissioned B2B challenge.

---
