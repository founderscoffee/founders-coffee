# Software Requirements Specification (SRS)

## founders.coffee — Multi-market founder community platform

| Field           | Value                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Document        | SRS — founders.coffee                                                                                 |
| Version         | 1.7                                                                                                   |
| Status          | Approved — architecture locked                                                                        |
| Owner           | Founder / Product                                                                                     |
| Last updated    | 2026-09-14                                                                                            |
| Target stack    | Nx monorepo · TanStack Start (fullstack) · Drizzle + Cloudflare D1 · Better Auth · Cloudflare Workers |
| Source research | Market validation sessions (Algeria + MENA) — see Appendix A                                          |

> **How to read this document.** Sections 1–4 are product/business context. Sections 5–9 are the requirements (Functional, Non-functional, Data, Architecture, UX) with stable IDs (`FR-*`, `NFR-*`) for traceability into the implementation plan. Sections 10–14 cover configuration, extensibility guardrails, compliance, risks, and decisions. Everything needed to produce a detailed implementation plan should be derivable from this document.

> **Current release boundary.** The first release is solely for community building through free
> local events, repeat participation, hosts, and the operations required to run that loop reliably.
> Hackathons, sponsorship products, talent, payments, and expansion are future work. They do not
> begin until the community density gate is met and Founder / Product explicitly opens the next
> phase. See [Release Strategy — Community First](./release-strategy.md).

---

## 1. Product vision

### 1.1 What we are building

**founders.coffee** is a **community business**: an informal, "no formalities" platform where local founders, builders, and students meet over coffee to discover their ecosystem, find collaborators, and grow together. It is composed of three reinforcing layers:

1. **Local events (free; current release)** — anyone hosts a casual coffee meetup at a local café; anyone joins. This is the community engine, the cultural core, and the sole focus of the first release.
2. **Online hackathons / challenges (future)** — a possible community-positive engagement and commercial layer, gated by proven community density.
3. **Sponsorships & partnerships (future)** — a possible revenue layer that is valuable only after a real community exists.

### 1.2 Brand principles (non-negotiable)

- **"No formalities."** Informal, warm, low-stakes. The brand is anti-corporate, anti-pitch-deck.
- **Community participation stays free.** Membership, events, participation, and ordinary community
  hosting are always free. If a future commercial phase is explicitly approved, organizations may
  pay only for clearly separated B2B services.
- **Community adds value; it is not mined.** Any future monetization may fund access to community
  opportunities through disclosed B2B products, never transactional fees on members.

### 1.3 Why this, why now (condensed)

- **Strong cultural fit in the Maghreb:** Algeria has a centuries-old café culture (Algiers alone: ~1,833 cafés, ~478 specialty). Coffee is already the default venue for informal business talk.
- **Real gap:** No dominant Algeria-native, self-serve, online, locally-payable founder-community/hackathon platform exists. Incumbents (`hackathon.dz`, `Soolvit`) are enterprise/B2B sales tools, not open community marketplaces. Established Gulf markets have a different gap (saturation + curation), not the same.
- **Government tailwinds:** Algeria's Startup Law (4-year corporate-tax exemption for labelled startups, 30% R&D/open-innovation tax allowance capped at 200M DZD), the Startup Fund, Algeria Venture, and the "1,000 Tech Startups" program.
- **Demographics:** ~46.8M population, ~79.5% internet penetration, 118% mobile connections, median age ~29.

(Full market data in Appendix A. Figures are directional and must be re-validated before launch.)

---

## 2. Business goals & success criteria

### 2.1 Primary business goals

1. **Achieve local community density in Algiers** before any monetization or expansion. Density is the only moat.
2. **Validate the free events wedge** through repeat participation and a healthy host loop in the initial Algeria/Algiers community.
3. **Keep future B2B revenue options documented, but do not launch them** until community density is proven and Founder / Product explicitly approves the next phase.
4. **Remain architecturally ready** for future expansion without making expansion part of the current release. DZ, EG, and SA are the configured active markets; initial operating focus remains Algeria/Algiers.

### 2.2 Success metrics (density-gated)

The current Founder / Product decision activates DZ, EG, and SA for the community release. Density
still gates activation of any future market, deeper operational expansion, and all monetized or
post-community features. The operating threshold is:

| Gate                                  | Threshold                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Future market: `dark` → `open`        | Architecture/config ready; landing page published; no active seeding.                                                                                                |
| Future market: `open` → `active`      | **≥ 8 completed events/month for 3 consecutive months, ≥ 3 recurring hosts, and host retention ≥ 60%.**                                                              |
| Open any post-community roadmap phase | Community release stable **AND** Algiers density threshold met **AND** repeat participation/host-loop evidence reviewed **AND** explicit Founder / Product approval. |
| Activate **hackathons** in a market   | Post-community phase explicitly approved **AND** market is `active` **AND** `hackathons` feature flag on **AND** the first real challenge is instrumented.           |
| Expand operational investment         | The candidate market or city meets the same density gate and has moderation and operational readiness.                                                               |

### 2.3 Explicit non-goals (current release)

- We are **not** building a global Devpost competitor.
- We are **not** charging for membership, community events, participation, or ordinary hosting. Any
  commercial B2B service belongs to a future explicitly approved phase.
- We are **not** expanding beyond the configured DZ, EG, and SA markets in this release.
- We are **not** launching hackathons, sponsorship products, sponsor dashboards, talent workflows, billing, payment execution, Founder Picks, or the proposed project showcase in the community-building release.
- We are **not** running talent or recruiting workflows in this release. Any future warm-introduction
  model requires explicit opt-in; transactional recruiting remains out of scope.
- We are **not** executing or recording product payment flows in this release. Any future approved
  flow must remain in-market and in-currency (§8.5).

---

## 3. Stakeholders & personas

| Persona                     | Description                                                                                                        | Core need                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Founder / Builder**       | Local entrepreneur, developer, or student builder                                                                  | Belong to a trusted local community, meet collaborators, learn, attend, return, and host. Community participation is free.                                       |
| **Host**                    | A founder or community lead who creates a free local meetup                                                        | A frictionless way to convene people, build trust, and establish a healthy recurring community ritual.                                                           |
| **Participant**             | Attends local community events                                                                                     | Discover relevant nearby events, RSVP, attend, return, and form useful local relationships.                                                                      |
| **Sponsor (future)**        | Telco, bank, labelled startup, ecosystem funder                                                                    | A later stakeholder only after the community has measurable density and trust.                                                                                   |
| **Challenge host (future)** | A funded founder, company, or (rarely) investor who may later run a challenge to source talent or validate an idea | A future B2B need; not a current-release persona.                                                                                                                |
| **Project owner / Admin**   | Internal team running founders.coffee                                                                              | Operate the community, vet hosts, moderate events/users, and protect trust and safety. Future commercial administration remains dormant. Served by `apps/admin`. |

---

## 4. Scope & phased delivery

### 4.1 Phase summary

Delivery is stage-gated. The community event loop ships first and remains the only active product
scope until it proves durable local density. Future engines remain documented so they can be
evaluated later, but they are not current commitments and must not distract from community building.

| Phase                                           | Scope                                                                                                                                                                                                                                                                         | Exit criteria                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **P0 — Foundation**                             | Multi-market architecture, i18n/RTL, identity (Better Auth), geo model, market config, feature-flag system, payment _abstraction interface_ (no integrations), shared Nx libs scaffolded.                                                                                     | All three apps + shared libs scaffolded; DZ, EG, and SA configured as active markets; empty-state UX works. |
| **P1 — Community release (ships now)**          | Free local-event loop: discovery, profiles, hosting, RSVP/pre-start cancellation, reminders, closeout, attendance, feedback, repeat hosting, lightweight trust/moderation, multilingual public PWA, Arabic-only admin operations, accessibility, security, and observability. | Production-stable community flow; operational community-building can proceed.                               |
| **Community validation gate**                   | Operate the Algiers community, recruit credible hosts, deliver consistently useful meetups, and measure repeat participation and host retention.                                                                                                                              | Density threshold met, host loop healthy, and Founder / Product explicitly approves further product work.   |
| **P2 — Challenges (future option)**             | Challenge creation, teams, submissions, judging, results, and associated commercial workflows, only if opened after the validation gate.                                                                                                                                      | Defined only when the phase is explicitly approved.                                                         |
| **P3 — Sponsorship and talent (future option)** | Sponsor products, measurement, dashboard, Founder Picks, and opt-in talent workflows, only if opened after the validation gate.                                                                                                                                               | Defined only when the phase is explicitly approved.                                                         |
| **P4 — Payments and expansion (future option)** | Provider automation and additional-market operations only after community, compliance, and market-specific readiness are demonstrated.                                                                                                                                        | Defined only when the phase is explicitly approved.                                                         |

> **Sequencing principle:** finish and operate the community release first. Do not begin the
> hackathon, sponsorship, talent, payment, or expansion phases merely because their plans or
> foundations exist. If the community loop fails, fix or reconsider that proposition instead of
> compensating with later product layers.

---

## 5. Functional requirements

Requirement IDs use the prefix `FR`. Each is tagged with phase (`P0`–`P4`) and, where relevant, the market states it applies to.

### 5.1 Multi-market & geography (P0)

- **FR-G1** The system shall model geography as **Market → State → City**. Markets are D1 configuration rows; states and cities are versioned server-side reference datasets.
- **FR-G2** Market-facing records shall carry `market_code` and, where geographic, `state_code`
  and `city_code` from creation. The global identity and its profile/account preferences (FR-A1,
  FR-A3) are not residence records; activity, events and host trust retain their market/geographic scope.
- **FR-G3** A Market shall have a **state**: `dark`, `open`, or `active` (see §10.1). State is admin-configurable.
- **FR-G4** Market state and feature activation shall be data/configuration changes. Adding or correcting state/city reference data requires a reviewed dataset change and deployment until admin-managed geography is implemented.
- **FR-G5** The system shall pre-seed major cities for each configured market.
- **FR-G6** Users shall be able to discover events by city ("near me" / by selection) within an active or open market.

### 5.2 Local events — the free wedge (P1, all markets in `open`/`active` state)

- **FR-E1** Any authenticated user (a _host_) shall be able to create a free local event: title, description, venue (café/coworking), date/time (in the city's timezone), capacity, language, category.
- **FR-E2** All events shall be **free** (`is_free = true`). Paid events/tickets are out of scope.
- **FR-E3** Any authenticated user shall be able to **RSVP** to an event and cancel while trusted
  server time is strictly before `startsAt`. At and after `startsAt`, create/cancel/restore shall be
  rejected and RSVP intent shall remain immutable for attendance eligibility.
- **FR-E4** The system shall enforce capacity and show remaining seats.
- **FR-E5** Each city landing page shall display that city's upcoming events.
- **FR-E6** **Empty-state UX:** a city with no events shall invite the visitor to become the first host ("Be the first to host a founders.coffee in {city}"). It must never appear "dead."
- **FR-E7** Hosts shall have a public profile showing their hosted events (reputation).
- **FR-E8** The system shall send notifications: RSVP confirmations, reminders before the event, host notifications on new RSVPs.
- **FR-E9** Events shall support tagging the spoken/written language (user-generated content is not auto-translated).
- **FR-E10** (Anti-no-show) The system shall use timely reminders and effortless pre-start
  cancellation to reduce no-shows. RSVP remains immediate and shall not require a seat hold, vow,
  or second confirmation.
- **FR-E11** After an event ends, its host shall record whether it was held or did not happen. An
  elapsed end time alone shall not count as a completed event. Legacy rows with no `endsAt` shall be
  excluded from closeout and completed-event metrics, shown as an admin attention state, and changed
  only through explicit audited backfill.
- **FR-E12** For a held event, the host shall record attended/no-show outcomes for eligible going
  RSVPs frozen at `startsAt` and an aggregate anonymous walk-in count. Attendance outcome shall
  remain separate from RSVP intent and shall not be exposed publicly at member level. Every
  person-level admin correction shall retain append-only actor, Access subject, reason, time, and
  before/after audit evidence.
- **FR-E13** A member recorded as attended shall be able to submit one private, updateable,
  time-bounded feedback pulse containing a structured value rating, return intent, and optional
  bounded comment. A held closeout submitted within seven days of `endsAt` shall invite eligible
  members; create/update access shall end fourteen days after `endsAt`, and a late closeout shall not
  reopen the window. A non-empty comment shall carry its authored `ar`, `fr`, or `en` language.
- **FR-E14** The system shall send localized post-event prompts using PWA push first and email
  fallback; SMS is reserved for same-day cancellation disruption:
  an idempotent closeout prompt to the host after event end, feedback/return to attended members
  after a timely held closeout, and a transparent notice to frozen going members when the host
  records `did_not_happen`.
- **FR-E15** A host shall be able to start another event from a completed event using safe prefilled
  values. The new event shall pass the complete event-create validation, authorization, abuse, and
  persistence flow with fresh schedule, ID, slug, and security response.

### 5.3 Online hackathons / challenges (future, post-community gate)

> Gated by the full post-community approval decision, then by market state = `active` and the
> `hackathons` feature flag. If opened, community participation remains free; any initial prize
> payout process is manual-first.

- **FR-H1** Any authorized user shall be able to **create a challenge**: problem statement, rules, timeline, judging criteria, prize (Money, local currency), eligibility.
- **FR-H2** Challenges shall be **free to create** for students/community (acquisition). Paid "hosted challenges" are a separate B2B flow (see §5.5).
- **FR-H3** Participants shall be able to **register, form/join teams, and submit** entries (link/repo/text/media).
- **FR-H4** The system shall support **judging**: rubric-based scoring by assigned judges, with conflict-of-interest handling.
- **FR-H5** The system shall display **leaderboards / results** and winner(s).
- **FR-H6** If this future phase opens, winners shall be owed **prize payouts in the local
  currency**. The initial payout process is recorded in-system and executed manually; automation
  requires separate approval and compliance review.
- **FR-H7** The system shall support sponsor attachment to a challenge (branding, prize funding) — see §5.4.
- **FR-H8** A challenge shall be **scoped to a market** (in-market participants, in-currency prizes). Cross-market challenges are out of scope.

### 5.4 Sponsorships & partnerships (future, post-community gate)

- **FR-S1** The system shall support configurable **sponsorship packages** (see §10.3 for the catalog and indicative pricing).
- **FR-S2** A sponsor shall be attachable to: a city/event series ("Coffee Series Sponsor"), a single event, a challenge, or a "Founder Picks" category.
- **FR-S3** Sponsored surfaces shall be **clearly disclosed** (brand integrity rule: the "no formalities" trust must not be violated).
- **FR-S4** Sponsors shall have a dashboard (in `apps/dashboard`) showing reach/engagement metrics (events sponsored, builders reached, RSVPs).
- **FR-S5** "Founder Picks" shall be a categorized recommendation surface (tools/services/venues) where sponsorship is disclosed, never deceptive.

### 5.5 Paid hosted challenges & talent pipeline (future, post-community gate)

- **FR-P1** A commercial client (company, sponsor, fund, or founder acting in a business-client capacity) shall be able to commission a hosted challenge to **source talent or validate an idea**, paying a flat fee.
- **FR-P2** The system shall capture the challenge host's intent (e.g., "find a technical co-founder", "validate concept", "brand + hiring").
- **FR-P3** If this future commercial phase opens, the hosted-challenge service fee shall be
  recorded as an Order and initially confirmed manually by an admin after external payment. The
  generic `host_fee` purpose is deprecated and must never be used for ordinary community hosting.
- **FR-P4** (Community-positive talent) The system shall enable **warm introductions** between challenge participants and interested hosts/funders, with explicit participant opt-in. This is **not** transactional recruiting and must feel organic.

### 5.6 Identity & accounts (P0)

- **FR-A1** The system shall maintain **one global user identity** per person (a user may relocate/travel).
- **FR-A2** Activity and reputation shall be **scoped per market/city** (e.g., a host's Algiers history vs. a Cairo attendance history).
- **FR-A3** Profiles and onboarding shall not require, expose or retain a home market, state or city.
  Event geography remains required; an optional device-local browsing preference shall not be
  treated as residence or copied into the member profile. Existing home-location columns shall
  be retired through the reviewed migration in the [profile/account plan](./profile-account-implementation-plan.md).
- **FR-A4** Authentication shall be **passwordless**. The current community release exposes
  **email OTP** plus configured OAuth providers. Phone OTP via Twilio Verify is a backend capability
  but is not an active user flow until a separately reviewed phone-login UI is enabled. OAuth
  accounts link to a single identity by verified email (trusted providers only). No passwords.
- **FR-A5** Roles: `member`, `host` (a member who has hosted), `sponsor_contact`, `admin`, `moderator`.
- **FR-A6** A minimal public profile shall show a display name and public hosted-event evidence.
  Uploaded profile avatars and introductions are optional and public without separate visibility switches.
  Interests, spoken languages and one personal website shall
  be optional and published only by explicit per-field opt-in. The profile has no self-described
  community-role field; account permission roles remain separate. Private contact details, system
  permissions and individual attendance stay private. Members may select up to five interests,
  including investing, software development, building products and validating ideas, and up to six
  spoken languages: Arabic, French, English, Spanish, German and Tamazight. Spoken-language choices
  do not add interface locales.
- **FR-A7** Members shall edit and clear their own profile fields, control optional publication,
  manage their own activity from `apps/ui`. The profile editor has no embedded public preview; the
  public profile remains a separate page. Optional completion shall
  not block event creation or RSVP. Visibility shall be enforced in API, SSR, metadata and caches.
- **FR-A8** Members shall manage verified email/phone, configured login providers and active sessions
  through Better Auth. Sensitive changes require recent authentication, prevent loss of the last
  usable login method and shall not enable a separate phone-login flow implicitly.
- **FR-A9** Members shall manage interface locale and notification preferences, with PWA push primary
  and SMS disruption only to a verified, consented number. Current preferences and destinations shall
  be enforced at dispatch as well as scheduling; browser permission and delivery state stay distinct.
- **FR-A10** Members shall request private data export and confirmed account deletion from account
  settings. Deletion shall revoke access, remove public identity and personal delivery, safely handle
  future events/RSVPs, and remove or pseudonymize retained records under NFR-5 without silently
  destroying community evidence or violating frozen attendance eligibility.
- **FR-A11** Members shall upload, replace and remove optional profile photos through protected
  Worker-mediated R2 storage and Cloudflare Images processing, with bounded validation, metadata
  removal, private originals and eligibility-checked public avatar delivery. Service entitlement and cost checks
  precede provisioning; removed, replaced or moderation-suppressed photos shall no longer be served publicly.

FR-A3 and FR-A6 through FR-A11 describe the approved target, not completed implementation. Delivery
and legacy migration are tracked by PF-01 through PF-12 in the
[Profile and Account Management Implementation Plan](./profile-account-implementation-plan.md).

### 5.7 Internationalization & localization (P0)

- **FR-L1** All user-facing strings shall be **externalized** to locale resources. Zero hardcoded copy.
- **FR-L2** Public member and host UI shall support **right-to-left (RTL) and left-to-right (LTR)**
  layout driven by the active locale/market direction. `apps/admin` is Arabic-only and RTL.
- **FR-L3** Public/member/host surfaces shall use a **locale fallback chain** ending at the base locale
  `ar` (e.g., `fr → ar`, `en → ar`). `apps/admin` always resolves to `ar` and has no locale switcher.
- **FR-L4** Public/member/host dates, times, numbers, and currencies shall be formatted per the active
  locale and relevant timezone. Admin formatting uses Arabic locale and the relevant timezone.
- **FR-L5** User-generated content shall be tagged with a language code and **not auto-translated**.
  Profile introductions are an explicit exception: no writing-language field is collected or inferred;
  render their text unchanged with automatic direction. Event and feedback language tags remain required.
- **FR-L6** The default locale for a market is determined by `Market.default_locale`.

### 5.8 Admin & moderation (P0/P1) — served by `apps/admin`

- **FR-M1** Project owners shall have the operational controls required to run the current community.
  D1-backed market/feature configuration and future commercial controls require separate roadmap
  approval. State/city reference data remains versioned code.
- **FR-M2** Moderators shall be able to review/remove events, profiles, and current user-generated
  content, with **language/region awareness**. Future challenge content is added only if that phase
  is opened.
- **FR-M3** The system shall support host verification (light trust mechanism) to reduce spam/abuse without adding formality.
- **FR-M4** The system shall log current moderation and trust actions for audit. Future commercial
  actions require the same audit standard if enabled.
- **FR-M5 (future)** If a commercial phase is approved, admins shall be able to confirm manual
  payments for sponsorship orders, hosted-challenge fees, and prize payouts (§8.5).
- **FR-M6** Authorized moderators/admins shall have a market-scoped operations workspace for
  upcoming events, overdue closeouts, event outcomes, attendance aggregates, delivery failures,
  moderation, host trust, and audited correction. Ordinary hosts shall complete their own events in
  `apps/ui`, not `apps/admin`. Every privileged request shall verify the Access JWT, resolve an
  admin-owned Better Auth session, require equality between their verified emails, and carry both
  the Access subject and Better Auth user ID into authorization and audit context. Two valid but
  unrelated identities shall fail closed. A closeout-outcome correction shall atomically reconcile
  pending feedback invitations, future feedback eligibility, did-not-happen participant notice,
  retained audit evidence, and completed-event metrics.
- **FR-M7** Authorized admins shall have a community-health dashboard implementing the canonical
  completed-event, recurring-host, 60-day host-retention, repeat-participation, RSVP-conversion,
  no-show, return-intent, host-again-intent, closeout-backlog, and four-week schedule definitions.
  Every rate shall show its numerator, denominator, window, timezone, and as-of time.
- **FR-M8** The weekly community review shall be stored as a market-scoped D1 record with evidence
  window, structured bottleneck, bounded intervention, owner, due date, and follow-up result. No CRM
  shall be required for the current release, and the bounded text shall contain no member PII.
- **FR-M9** A market-scoped `communityOperations` feature flag shall gate closeout, feedback,
  repeat-host, operations, and metrics entry points at both UI and server boundaries. It is enabled
  for every configured market by Founder decision. Disabling it shall preserve data and shall not
  disable moderation or host-trust safety controls.
- **FR-M10** Closeout, attendance, feedback, host trust, audit, and weekly-review records shall be
  market-scoped at rest. Host trust shall be unique per market/member. Host friction shall use
  `venue`, `scheduling`, `promotion`, `attendance`, `format`, `safety`, or `other_structured`;
  correction/moderation shall use `host_request`, `member_dispute`, `data_entry_error`, `safety`,
  `policy`, or `delivery_recovery`. A bounded private note shall be required for
  `other_structured` and excluded from logs/Analytics. Weekly bottleneck shall use `host_supply`,
  `calendar_consistency`, `venue_readiness`, `discovery`, `rsvp_conversion`, `attendance`,
  `event_quality`, `return_behavior`, or `product_reliability`.

### 5.9 Notifications & communications (P1)

- **FR-N1** Event notifications shall use **PWA web push (FCM)** as the primary channel for subscribed devices and **Cloudflare Email** as the default fallback. Twilio Programmable SMS is reserved for same-day cancellation disruption and requires a verified, consented number. Twilio Verify remains authentication-only.
- **FR-N2** Notification preferences shall be user-configurable.
- **FR-N3** Notifications shall be localized.

---

## 6. Non-functional requirements

| ID         | Category             | Requirement                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NFR-1**  | Performance          | Event listing/detail server functions shall respond ≤ 300ms (p95) at MVP load.                                                                                                                                                                                                                                                                                                                     |
| **NFR-2**  | Scalability          | Stateless Workers (auto-scaling edge); no single-market coupling in hot paths. See §8.7 for the D1 data-scale ceiling and escape hatches.                                                                                                                                                                                                                                                          |
| **NFR-3**  | Availability         | MVP target: 99.5% uptime; graceful degradation if a current external service is unavailable. Future payment-provider behavior is assessed only when that phase opens.                                                                                                                                                                                                                              |
| **NFR-4**  | Security             | OWASP top-10 controls; input validation at the server-function layer (Zod); secrets via Wrangler env/Cloudflare secrets, never in repo; rate limiting on auth and create endpoints.                                                                                                                                                                                                                |
| **NFR-5**  | Privacy              | Minimal PII collection; explicit consent for talent-pipeline opt-in (FR-P4); export/deletion support; closeout, attendance, structured feedback, weekly reviews, and audit retained 24 months; feedback comments 12 months; current host trust for the account lifetime and 24 months after closure/last transition; non-PII monthly aggregates indefinitely, unless applicable law requires less. |
| **NFR-6**  | Compliance           | The community release must meet applicable privacy, communications, and event-operation obligations. Any future payment flow requires a separate market-specific regulatory review and no cross-border money movement.                                                                                                                                                                             |
| **NFR-7**  | Observability        | Structured logging, request tracing, community metrics (events created/completed, RSVPs, repeat participation, recurring hosts, density per city/market), and alerts on current operational failures. Cloudflare observability enabled.                                                                                                                                                            |
| **NFR-8**  | Accessibility        | Public frontend shall meet WCAG 2.1 AA in LTR and RTL; `apps/admin` shall meet WCAG 2.1 AA in Arabic RTL.                                                                                                                                                                                                                                                                                          |
| **NFR-9**  | Internationalization | Public/member/host features must work correctly under RTL/LTR and for multi-currency/multi-timezone without code branches per market; `apps/admin` is Arabic-only RTL.                                                                                                                                                                                                                             |
| **NFR-10** | Maintainability      | Strict TypeScript; clean Nx library boundaries; adding a market or payment provider must not touch unrelated modules.                                                                                                                                                                                                                                                                              |
| **NFR-11** | Testability          | Unit/integration tests for domain and server logic; Playwright for signup → create event → RSVP and the three-checkpoint reminder → RSVP-freeze → real event end → closeout → feedback → admin review flow. Deployed test-only clock/completion endpoints are forbidden. Future phases add acceptance flows only if approved.                                                                      |
| **NFR-12** | Deployability        | Each app deploys to Cloudflare Workers via Wrangler (`wrangler deploy`); buildable via Nx/Vite targets.                                                                                                                                                                                                                                                                                            |

---

## 7. Data model (conceptual)

Storage: **Cloudflare D1** (SQLite-based, edge). ORM: **Drizzle** (portable to Postgres — the Year-2+ escape hatch, §8.7).

```
Market (D1)
  code (DZ | EG | SA), name, slug
  default_locale, default_currency, timezone, direction (rtl|ltr)
  state (dark | open | active)
  feature_flags { events, communityOperations, hackathons, payments, recruiting }
  payment_providers[]            // empty until P4 wiring
  brand_overrides {}             // accent color, tagline key, etc.

GeoState / GeoCity (versioned server-side reference data)
  market_code, state_code, city_code, names, slug, featured

User
  global identity; email/phone; role; locale_pref; account lifecycle
  // no residence fields; legacy home columns removed through PF-03
  // talent opt-in flag (FR-P4)

MemberProfile / AccountPreferences (planned, PF-02)
  user_id; optional public introduction; interests; spoken languages
  personal website (stored as professional_link); photo asset reference; per-field publication; revision
  private notification preferences and consent; no home market/state/city

Event
  id, market_code, state_code, city_code, host_user_id
  title, description, venue, starts_at, ends_at, capacity, language, category
  rsvps (denormalized counter), is_free = true
  latitude, longitude, venue_address
  sponsorships[]                 // sponsor surfaces attached (FR-S2)
  // reserved-for-later (P2+): challenge_id, prize (Money)

EventRsvp
  event_id, user_id              // UNIQUE(event_id, user_id) — idempotent RSVP
  status (going | waitlist | cancelled)
  created_at
  // Mutations stop at starts_at; the frozen going set determines attendance eligibility.

EventCloseout
  event_id, market_code, state_code, city_code
  outcome (held | did_not_happen), walk_in_count, would_host_again, host_friction[]
  submitted_by_user_id, submitted_at, updated_by_user_id, updated_at, version

EventAttendance
  id, event_id, user_id, market_code, state_code, city_code
  outcome (attended | no_show), recorded_by_user_id, recorded_at, updated_at
  // UNIQUE(event_id, user_id); every correction also appends an OperationsAudit row.

EventFeedback
  id, event_id, user_id, market_code, state_code, city_code
  value_rating, would_return, bounded_comment?, comment_language?
  created_at, updated_at
  // UNIQUE(event_id, user_id); comment_language is required when comment is non-empty.

HostTrust
  id, market_code, user_id, status, reason_code, reviewed_by_user_id, reviewed_at, updated_at
  // UNIQUE(market_code, user_id)

OperationsAudit
  id, market_code, actor_user_id, access_subject?, action, target_type, target_id
  reason_code, bounded_non_pii_metadata, created_at

OperationsReview
  id, market_code, state_code?, city_code?, evidence_window_start, evidence_window_end
  bottleneck, bounded_intervention, owner_user_id, due_at, follow_up_result?
  created_by_user_id, created_at, updated_at

CommunityMetricSnapshot
  id, market_code, scope_type, non_null_scope_code, period_month, metric_key
  numerator, denominator?, computed_at
  // Market-local non-PII monthly aggregate retained after bounded raw-data expiry.

ScheduledNotification
  id, event_id, user_id
  channel (push | sms | email), template_key
  payload (JSON), status (pending | sent | failed)
  send_at (unix timestamp), created_at
  // Event alarms enqueue due work; a low-frequency sweep only recovers missed alarms.
  // One logical event delivery selects push first and creates email fallback only when needed.

PushSubscription                (PWA web push via FCM HTTP v1)
  id, user_id, token (device token or FCM web push token)
  platform (web), surface (pwa), market_code
  created_at, updated_at
  // Multiple tokens per user (multiple devices); invalidated on logout or DeviceNotRegistered

Challenge   (future, only after post-community approval)
  id, market_code, host_user_id (or sponsor_id), commercial_client_id?
  problem, rules, timeline, judging_criteria, prize (Money), currency
  participants[], teams[], submissions[], judges[], winners[]
  status (draft | live | judging | completed)

Sponsor   (future)
  id, name, logo, markets[], package_type, surfaces[]

Sponsorship   (future)
  sponsor_id, surface (series | event | challenge | founder_picks_category)
  market_code, start_date, end_date, disclosure_text

Order / Invoice   (future commercial phase: manual-first payments)
  id, market_code, type (sponsorship | hosted_challenge_fee | prize_payout)
  amount (Money), currency, status (pending | paid | refunded | failed)
  payer_ref, payee_ref, due_date, paid_at
  confirmed_by_admin_id         // who marked it paid (FR-M5)
  external_ref                  // bank transfer / BaridiMob txn id, entered manually
  // Initial future phase: no provider integration. Admin confirms after external payment.

PaymentRecord   (P4+: populated when providers are wired)
  id, market_code, provider_code, type (collection | payout)
  amount_minor (int), currency, status, ref (order_id / user_id)

Money (value object, used everywhere — never bare numbers)
  amount_minor: int   // minor units (e.g., centimes)
  currency: string    // ISO 4217 (current markets: DZD, EGP, SAR; dormant payment foundations may retain additional codes)
```

**Rule:** monetary values are always `{ amount_minor, currency }`. Never store or pass a bare
number for money. The current release has no product payment flow. If a commercial phase is opened,
its initial approach is manual recording/confirmation with no automated provider calls.

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
- **Security:** **Turnstile** (bot protection on public/anonymous forms and operations); authenticated session mutations use Better Auth sessions, centralized authorization, and rate limiting without a browser challenge. **Cloudflare Access / Zero Trust** gates `apps/admin` to the team.
- **Observability:** **Analytics Engine** (product metrics) + **Web Analytics** (privacy analytics); structured logging.
- **Secrets:** **Cloudflare Secrets Store / `wrangler secret`**.
- **Auth:** **Better Auth** — the current UI uses passwordless email OTP plus configured OAuth
  providers; phone OTP via Twilio Verify is a dormant backend capability. Account linking uses
  trusted providers; web sessions live in D1 (not KV), with bearer-token readiness for future clients.
- **Mobile:** `apps/ui` is an installable Serwist PWA. PWA Builder may package that same PWA for stores; a separate native app is not committed scope.
- **Testing:** **Vitest** + **Playwright** against **Miniflare** (real local Cloudflare bindings — no platform mocks).
- **Language:** TypeScript 6, strict.

### 8.2 App topology (clean separation from day 1)

Three independent, fullstack TanStack Start apps (each its own Worker) + a dedicated jobs worker, all sharing the same core via Nx libs:

| App                    | Audience                                                   | Role                                                                                                                                                                                               | Notes                                                                                   |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **`apps/ui`**          | Public                                                     | The community site: events discovery, city landing pages, host profiles, SEO/prerendered, the "be the first host" empty state. **This is the installable PWA**; PWA Builder packaging is optional. | Anon-accessible; heavily prerendered.                                                   |
| **`apps/dashboard`**   | Future sponsors (authenticated)                            | Dormant shell for a possible future sponsorship/commercial-challenge product.                                                                                                                      | Outside the current release; no member/host event workflows.                            |
| **`apps/admin`**       | Project owners / internal team (authenticated, privileged) | Current event/user moderation, host trust, and essential community operations; future market/commercial controls remain dormant. Arabic-only RTL interface.                                        | Strictly separated; gated by **Cloudflare Access**; privileged code never ships public. |
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
  payments/        // dormant future PaymentProvider foundation; not current-release scope
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
- **Feature flags per market** drive current rollback and future activation (for example,
  `communityOperations` for the accepted operations slice and future challenges only where
  `feature_flags.hackathons === true`).
- **Per-market configuration** (locale, currency, timezone, direction, brand) is data-driven, not hardcoded.

### 8.5 Payment handling — future only, manual-first if activated

There is no product payment flow in the community-building release. Existing payment abstractions
may remain as dormant foundations; they are not launch requirements and must not be extended without
passing the community validation gate and receiving explicit Founder / Product approval.

- **Existing abstraction, retained for a possible future phase:**
  ```
  interface PaymentProvider {
    marketCode: string;
    charge(input: ChargeInput): Promise<ChargeResult>;   // collections (commercial client pays us)
    payout(input: PayoutInput): Promise<PayoutResult>;   // payouts (we pay winners, in-currency)
    status(id: string): Promise<PaymentStatus>;
  }
  ```
- **Initial approved commercial phase:** money may be recorded as `Order`/`Invoice` rows and an
  admin confirms external payment manually. No provider calls, webhooks, or merchant-of-record.
- **P4, if separately approved:** implement compliant DZ adapters behind the same interface.
  Additional markets require their own readiness and compliance decisions.
- Collections and payouts are modeled as **separate flows** (different regulators).

### 8.6 i18n / RTL architecture

- **Language-level locales** (not region variants): **`ar`** (a single Modern Standard Arabic used for _all_ Arabic markets), **`en`**, **`fr`**. Shared via `libs/i18n`.
- **Public Arabic-first:** `apps/ui` supports **`ar`**, **`fr`**, and **`en`**; `ar` is the base and final
  fallback. `apps/admin` supports only `ar`.
- Messages via **Paraglide** (compile-time, type-safe); formatting via native **`Intl.*`** (full ICU on Workers, no flags). **Latin digits forced** across all locales (`numberingSystem: latn`).
- Direction (`rtl`/`ltr`) is a first-class property of the active public locale; public screens are
  built and tested in both directions. Admin screens are intentionally Arabic RTL only.
- Public locale fallback chain ends at the base locale `ar` (`fr → ar`, `en → ar`), so partial
  translations never break the PWA UI.
- Public locale is cookie-based (clean URLs, no locale prefix). Resolution is user preference/cookie
  → market default → `ar`; browser `Accept-Language` does not override it. Admin always resolves to
  Arabic and does not expose a locale switcher.

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

| State      | Visible?         | Seeded/Market?                                              | Used for                                      |
| ---------- | ---------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **dark**   | No               | No                                                          | Future markets — exists in code/data only.    |
| **open**   | Yes (self-serve) | No                                                          | Transitional state before activation.         |
| **active** | Yes              | Yes (host recruitment, marketing, partnerships, moderation) | Full operational investment. (DZ, EG, and SA) |

### 10.2 Per-market configuration (target end-state)

| Market | Default locale    | Direction | Currency | Timezone       | Payment rails (P4)                   | Launch state |
| ------ | ----------------- | --------- | -------- | -------------- | ------------------------------------ | ------------ |
| 🇩🇿 DZ  | `ar` (+`fr`,`en`) | rtl       | DZD      | Africa/Algiers | BaridiMob, CIB, Edahabia, DZ MOB PAY | **active**   |
| 🇪🇬 EG  | `ar` (+`en`,`fr`) | rtl       | EGP      | Africa/Cairo   | InstaPay (IPN), Fawry, Vodafone Cash | **active**   |
| 🇸🇦 SA  | `ar` (+`en`,`fr`) | rtl       | SAR      | Asia/Riyadh    | Mada, STC Pay, SARIE, Geidea         | **active**   |

**Market rule:** DZ, EG, and SA are configured as active. Adding another market requires an explicit Founder / Product decision plus geography, operational, and compliance readiness.

### 10.3 Future sponsorship research (indicative pricing, DZ)

This catalog is preserved only as future research. It is not a launch offer, current sales plan, or
authorization to build sponsor surfaces before the community gate.

| Package                              | Description                                                                                            | Indicative price (Y1)            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| **Coffee Series Sponsor** (anchor)   | "founders.coffee Algiers, presented by [brand]"; logo on every event; 1 meet-the-founders slot/quarter | 1.5–3M DZD / year                |
| **The Coffee** (micro-sponsor)       | Sponsors the coffee at every meetup (brand on cups/coaster)                                            | 200–500K DZD / quarter           |
| **Founder Picks** (category sponsor) | Disclosed recommendation in a category (e.g., a SaaS/payment tool)                                     | 300–800K DZD / year per category |
| **Single-event partner**             | One event/mixer branding + hiring booth                                                                | 150–400K DZD / event             |
| **Hosted challenge** (paid, P2)      | Flat fee to commission a talent/idea-validation challenge                                              | 1–3M DZD per challenge           |

(Prices are indicative and must be revalidated if the future sponsorship phase is ever opened. Any
initial approved payment operation would be recorded as an Order and confirmed manually by an
admin.)

---

## 11. Extensibility guardrails (build now vs. defer)

**Retain or complete for the community release:**

- i18n framework with RTL from line one (FR-L1/L2/L3) in `libs/i18n`.
- `Money` value object used everywhere (NFR-9, §7).
- `market_code` plus `state_code`/`city_code` on geographic records; per-market config + feature flags (FR-G, §8.4).
- Externalized copy; direction-aware layout.
- Timezone-safe date/time handling.
- Drizzle schema in `libs/db` (portable to Postgres).

**Defer (do NOT build for the community release):**

- Additional sponsorship, challenge, talent, billing, or payment functionality, even where a foundation already exists.
- Payment recording, confirmation, and provider integrations (§8.5).
- Multi-tenant DB isolation (not needed).
- i18n CMS (static JSON resources suffice until scale).
- Cross-border payments / cross-market challenges.
- Transactional recruiting.
- A dedicated API **gateway** (only if a non-JS client or external integrations appear — §8.7).
- Containers (only if a job needs a Node-only library — §8.7).

---

## 12. Compliance, privacy & trust

- **Future payments:** if a commercial phase is approved, begin manual-first and complete the
  applicable market-specific compliance review before any collection or payout work (NFR-6).
- **Startup Label (DZ):** Investigate obtaining Algeria's startup label (4-year tax exemption + Startup Fund access) as a structural advantage. (Operational, not software — but flagged here.)
- **Content moderation:** Language/region-aware (FR-M2); a market's content is moderated by a fluent moderator, via `apps/admin`.
- **Talent opt-in:** Explicit, revocable consent for any warm-intro/talent pipeline use of a member's data (FR-P4, NFR-5).
- **Data residency:** Assess per-market requirements during P4 planning.
- **Admin separation:** `apps/admin` is a distinct app so privileged operations and code are isolated from public bundles.

---

## 13. Decisions (resolved)

| #   | Decision                  | Resolution                                                                                                                                                                                                                                        | Rationale                                                                                                                                                                                                         |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Database**              | **Cloudflare D1**                                                                                                                                                                                                                                 | Edge-native, cheap, fits Workers; primary near Maghreb. Postgres is the Year-2+ escape hatch via Drizzle.                                                                                                         |
| D2  | **ORM**                   | **Drizzle**                                                                                                                                                                                                                                       | Edge-native (unlike Prisma on Workers); portable to Postgres.                                                                                                                                                     |
| D3  | **Frontend framework**    | **TanStack Start** (fullstack) + Query, Form, Table, Virtual, Store, Config                                                                                                                                                                       | Typed server functions = the backend; full TanStack toolset; end-to-end type safety; edge-native.                                                                                                                 |
| D4  | **Auth method**           | **Passwordless Better Auth.** Current UI: email OTP plus configured OAuth. Dormant capability: phone OTP via Twilio Verify, enabled only after a separately approved UI decision.                                                                 | Matches operational reality while preserving one global identity, trusted account linking, no passwords, D1 sessions, and centralized rate limiting.                                                              |
| D5  | **Notification channels** | PWA web push via FCM (primary) + Cloudflare Email (default fallback) + Twilio Programmable SMS (same-day cancellation disruption)                                                                                                                 | Keeps event communication immediate while retaining a no-cost fallback; SMS is limited to the cases where an unread email could send someone to a venue unnecessarily. Twilio Verify remains authentication-only. |
| D6  | **Hosting region**        | Cloudflare edge; **D1 primary near Maghreb**                                                                                                                                                                                                      | Latency + data-residency considerations.                                                                                                                                                                          |
| D7  | **Monetization build**    | **Deferred until after the community validation gate and explicit Founder / Product approval.**                                                                                                                                                   | A sponsor product has no durable value before founders.coffee has a real, trusted, repeat community. Existing foundations are not a launch commitment.                                                            |
| D8  | **Hackathon engine**      | **Future option, not current committed delivery.** It may be opened only after the community validation gate and explicit approval.                                                                                                               | Challenges cannot rescue a weak community loop and must not distract from proving the local event community first.                                                                                                |
| D9  | **Backend architecture**  | **Fullstack TanStack Start; no gateway; retire NestJS**                                                                                                                                                                                           | Single client (the PWA); server functions preserve type safety; no NestJS on Workers.                                                                                                                             |
| D10 | **Payments**              | **No current-release flow.** If a commercial phase opens, start manual-first; automation remains a separate P4 decision.                                                                                                                          | Keeps payment and regulatory work from delaying community validation while preserving a low-risk future path.                                                                                                     |
| D11 | **Mobile**                | **Installable Serwist PWA**; optional PWA Builder packaging                                                                                                                                                                                       | One member client and no separate native codebase. React Native/Expo remains research, not committed scope.                                                                                                       |
| D12 | **App separation**        | **Three apps** (`ui`, `dashboard`, `admin`) + `worker-jobs`                                                                                                                                                                                       | Clean separation + security isolation from day 1; dedicated jobs worker.                                                                                                                                          |
| D13 | **Email**                 | **Cloudflare Email** (native) + React Email templates                                                                                                                                                                                             | Zero external vendors; native Worker binding; auto SPF/DKIM/DMARC.                                                                                                                                                |
| D14 | **Styling / UI**          | **Tailwind CSS v4 + DaisyUI**                                                                                                                                                                                                                     | Shared design system; RTL-aware; fast build.                                                                                                                                                                      |
| D15 | **AI & search**           | **Workers AI + Vectorize**                                                                                                                                                                                                                        | Semantic search over events/challenges; AI moderation; recommendations.                                                                                                                                           |
| D16 | **CF platform services**  | **R2 + Images, KV, Durable Objects, Workflows, Browser Rendering, Turnstile, Access, Analytics Engine**                                                                                                                                           | Single-vendor platform; real-time, orchestration, uploads, security, metrics — all native.                                                                                                                        |
| D17 | **First release scope**   | **Community building only:** free local events, repeat participation, hosts, trust/moderation, and the PWA operations required to run that loop.                                                                                                  | If community density and repeat participation fail, later sponsorship, challenge, talent, payment, and expansion layers will not succeed. Future work requires the density gate plus explicit approval.           |
| D18 | **Shared Free-plan WAF**  | Use the Cloudflare Free zone's single rate-limiting-rule slot for one path-based rule covering `/api/auth/` and `/_serverFn/` across staging and production. Keep the fail-closed Worker evidence gate and identity-scoped Durable Object policy. | The product is passwordless, so leaked-password protection does not justify consuming the only slot. One shared rule preserves layered protection without requiring a paid plan or duplicating environment rules. |

---

## 14. Risks & mitigations

| Risk                                                                              | Severity | Mitigation                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R-H1: Future layers distract from community validation**                        | **High** | Keep hackathons, sponsorship, talent, payments, and expansion outside the current release. Open a future phase only after the density gate and explicit Founder / Product approval. |
| **Cold-start / no-show death spiral** (free events → 30–50% no-show → hosts quit) | High     | Density-first (one city); timely reminders and easy cancellation (FR-E10); hand-recruit first hosts.                                                                                |
| **Ghost-town across markets** (multi-market spread thin)                          | High     | Three-state model (§10.1); density and operating evidence per active market; keep post-community expansion gated.                                                                   |
| **D1 data ceiling** (~10 GB / DB, no auto-sharding)                               | Medium   | Drizzle→Postgres migration path; per-market D1 sharding option (§8.7).                                                                                                              |
| **Future payment operational drag**                                               | Medium   | Do not activate payments in the community release; if later approved, start manual-first and measure operational cost before automation.                                            |
| **Brand dilution from future commercial layers**                                  | Medium   | Keep sponsor surfaces out of the current release; if later approved, require clear disclosure and preserve the community experience.                                                |
| **RTL/i18n technical debt**                                                       | Medium   | Build RTL-correct from P0 (FR-L2); shared `libs/i18n`; never defer.                                                                                                                 |
| **TanStack Start maturity**                                                       | Medium   | Accept the maturity tax for type safety; mitigate with shared libs + solid testing.                                                                                                 |
| **PWA push availability** (permission, installation, browser support)             | Medium   | Ask contextually, store preferences, and use email fallback when no valid push subscription exists; reserve SMS for same-day cancellation disruption.                               |
| **"Why not just use Meetup or a group chat?"**                                    | Medium   | Win through trusted local curation, Arabic/French/English community context, frictionless hosting, reliable reminders, and a repeat founder ritual—not through feature breadth.     |
| **Regulatory change** (market-specific)                                           | Low-Med  | Payment abstraction isolates per-market changes (§8.5).                                                                                                                             |

---

## 15. Glossary

- **Market** — a country configuration. DZ, EG, and SA are the configured active markets.
- **City** — a geographic unit within a market where events happen.
- **Market state** — `dark` (not visible), `open` (visible, self-serve, unseeded), `active` (fully operated).
- **Density** — the concentration of active hosts, events, and repeat attendance in a city; the core moat and the activation gate.
- **Hosted challenge** — a paid challenge commissioned by a founder/company to source talent or validate an idea.
- **Founder Picks** — a categorized, disclosed recommendation surface (sponsorable).
- **Money** — a `{ amount_minor, currency }` value object; the only legal representation of money in the system.
- **Order / Invoice** — a dormant future payable/receivable model; if a commercial phase opens,
  its initial status may be confirmed manually by an admin after external payment.
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

**Configured market context**

- 🇪🇬 Egypt — InstaPay (IPN, 40M+ users), Fawry; large population.
- 🇸🇦 Saudi — Mada, STC Pay, SARIE; Vision 2030 funding.

**Monetization model (B2B, invisible to founders)**

- Sponsorships (primary) + paid hosted challenges (flat fee) + community-positive talent pipeline. Community membership, participation, events, and ordinary hosting remain free; a founder acting as a commercial client may pay for a commissioned B2B challenge.

---
