# Implementation Plan

## founders.coffee — current delivery plan (P0–P4)

| Field        | Value                |
| ------------ | -------------------- |
| Version      | 2.0                  |
| Status       | Active               |
| Owner        | Engineering          |
| Last updated | 2026-08-30           |
| Derived from | [SRS v1.3](./srs.md) |

This document is the current sequencing and status source. Status is evidence-based:

- **Complete** — implemented and verified for the ticket’s stated scope.
- **Partial** — useful implementation exists, but acceptance or operational work remains.
- **Blocked** — unsafe to call complete; a named defect or prerequisite must be resolved first.
- **Planned** — no production implementation yet.

## 1. Canonical product and architecture decisions

- DZ is `active`; EG and SA are `open`; MA and AE are `dark`.
- Expansion requires eight completed events per month for three consecutive months, three recurring hosts, and at least 60% host retention.
- D1 owns market configuration. Versioned TypeScript datasets own state/city reference data.
- Geographic records use `market_code`, `state_code`, and `city_code`.
- `apps/ui` owns member and host workflows; `apps/dashboard` is sponsor-only; `apps/admin` is internal operations.
- The installable Serwist PWA is the committed mobile surface. React Native/Expo is research only.
- PWA web push is the primary event-notification channel; Twilio Programmable SMS is fallback.
- Per-entity reminders use Durable Object alarms feeding a Notifications Queue. Cron is recovery-only.
- TypeScript 6, base locales `ar`/`fr`/`en`, and shared Zod validation are canonical.
- TanStack Form is optional; local React state is acceptable when it reuses the shared Zod contract.
- AI lives at `@founders-coffee/core/ai`; delivery providers live in `libs/notifications`.
- Community membership, events, participation, and ordinary hosting are free. Commercial hosted challenges are B2B services.

## 2. Repository and data flow

```text
apps/
  ui/             member/host PWA
  dashboard/      sponsor portal
  admin/          internal operations console
  worker-jobs/    asynchronous and recovery work

libs/
  auth/ core/ db/ domain/ email/ i18n/ infra/ notifications/
  observability/ payments/ server-fns/ ui/

libs/core/src/ai/ server-only Workers AI and Vectorize ports
```

```text
component → hook → feature api.ts → server function → domain → repository → D1
```

Route loaders may wire server functions directly. Runtime imports from presentational components must pass through feature hooks and APIs.

## 3. Platform state

| Capability             | Required architecture                                        | Current state                                                                                              |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Sessions               | D1                                                           | Implemented                                                                                                |
| Identity rate limiting | Durable Object + WAF; Better Auth may additionally use D1    | Partial; DO exists, WAF coverage is unverified                                                             |
| Feature/config cache   | KV for idempotent reads only                                 | Planned, not bound                                                                                         |
| Event reminders        | DO alarms → Notifications Queue; low-frequency Cron recovery | **Blocked:** current one-minute D1 polling must be replaced                                                |
| PWA push               | FCM web push                                                 | Implemented; production credentials must be verified                                                       |
| SMS fallback           | Twilio Programmable SMS via `libs/notifications`             | Partial; provider exists, but the producer still schedules SMS/email alongside push instead of on fallback |
| Authentication SMS     | Twilio Verify via `libs/auth`                                | Implemented; deployed environments must fail closed if credentials are absent                              |
| Email                  | Cloudflare Email                                             | Code complete; sender-domain/DNS activation requires verification                                          |
| Search/AI              | Workers AI + Vectorize                                       | Foundations implemented; event search UI planned                                                           |
| Uploads                | R2 + Images                                                  | Provider foundation only; resources not bound                                                              |
| Product metrics        | Analytics Engine                                             | Library foundation only; binding/dashboards planned                                                        |
| Admin isolation        | Access + in-Worker JWT verification + no `workers.dev`       | Worker guard complete; Access configuration requires verification                                          |

## 4. Phase P0 — foundation

| ID     | Status   | Scope                                                     | Remaining evidence or work                                                     |
| ------ | -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0-001 | Complete | Nx workspace, TypeScript, lint boundaries, Vitest         | —                                                                              |
| P0-002 | Complete | Public TanStack Start Worker                              | —                                                                              |
| P0-003 | Complete | Sponsor dashboard scaffold                                | Product UI belongs to P3                                                       |
| P0-004 | Partial  | Admin Worker and Access JWT guard                         | Configure and verify Access in both environments                               |
| P0-005 | Complete | Core Result, AppError, Money, IDs, config                 | —                                                                              |
| P0-006 | Complete | D1/Drizzle schema, migrations, atomic helpers             | —                                                                              |
| P0-007 | Blocked  | Market configuration and geography                        | Change seed/config to DZ active, EG/SA open, MA/AE dark                        |
| P0-008 | Partial  | Better Auth, phone/email OTP, OAuth, RBAC                 | Production must fail closed when Twilio/email providers are absent             |
| P0-009 | Complete | Arabic-first `ar`/`fr`/`en` i18n and formatting           | —                                                                              |
| P0-010 | Complete | Shared Tailwind/DaisyUI design system                     | —                                                                              |
| P0-011 | Partial  | Typed resources and image-provider foundation             | Production R2/Images binding remains planned                                   |
| P0-012 | Complete | Server-function throw boundary, context, authz primitives | —                                                                              |
| P0-013 | Complete | Shared Zod validation convention                          | —                                                                              |
| P0-014 | Partial  | Structured logging and metrics API                        | Analytics binding, dashboards, and alerts remain                               |
| P0-015 | Partial  | Manual Order/Invoice payment foundation                   | Remove legacy `host_fee` from the schema/tests through a reviewed migration    |
| P0-016 | Partial  | Cloudflare Email provider and templates                   | Verify sender-domain activation; complete production templates                 |
| P0-017 | Complete | Workers AI/Vectorize ports and core operations            | —                                                                              |
| P0-018 | Blocked  | Jobs Worker                                               | Replace reminder polling; provision/bind Notifications Queue                   |
| P0-019 | Partial  | Staging/production Cloudflare provisioning                | Complete and verify manual DNS, Access, secrets, Queues, and required bindings |
| P0-020 | Partial  | GitHub Actions verification and environment deployments   | Verify account-side environment configuration                                  |
| P0-021 | Partial  | Miniflare and Playwright harness                          | Full critical-flow e2e and CI execution remain                                 |

## 5. Phase P1 — events launch

| ID     | Status   | Scope                                                                | Remaining evidence or work                                                                                                 |
| ------ | -------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| P1-001 | Complete | Market resolution and visibility                                     | Align seed states under P0-007                                                                                             |
| P1-002 | Complete | Geo redirect, canonical market/city pages, empty states              | —                                                                                                                          |
| P1-003 | Partial  | Email-OTP login UI, OAuth UI, and phone-OTP backend capability       | Phone login UI is not implemented; provider fail-closed and production verification remain                                 |
| P1-004 | Partial  | Geography datasets, onboarding, profiles                             | Profile persistence still uses legacy `home_state`/`home_city_id`; migrate to canonical state/city code names              |
| P1-005 | Complete | Event domain, repository, server functions                           | —                                                                                                                          |
| P1-006 | Partial  | Event creation wizard and Mapbox venue selection                     | Verify production credential; move remaining Mapbox calls behind the feature API and localize remaining inline copy        |
| P1-007 | Complete | Event feed/detail, virtualization, SEO metadata                      | Full prerender verification remains under P1-020                                                                           |
| P1-008 | Blocked  | Immediate idempotent RSVP and cancellation                           | Fix full-capacity atomicity so a rejected RSVP cannot be inserted; complete Turnstile/WAF coverage                         |
| P1-009 | Blocked  | PWA push primary, SMS fallback, email-specific delivery              | Replace minute polling with DO alarms → Queue; enforce fallback rather than parallel SMS/email; add delivery observability |
| P1-010 | Partial  | Live event Durable Object/WebSocket experience                       | Verify per-message session expiry, heartbeat cleanup, and cancellation behavior                                            |
| P1-011 | Planned  | Disclosed sponsorship surfaces                                       | —                                                                                                                          |
| P1-012 | Planned  | Sponsor media through R2/Images                                      | —                                                                                                                          |
| P1-013 | Planned  | Admin markets, flags, verification, moderation                       | Geography reference data remains versioned code, not admin-managed                                                         |
| P1-014 | Planned  | Admin manual payment confirmation and audit                          | —                                                                                                                          |
| P1-015 | Planned  | Semantic event search                                                | —                                                                                                                          |
| P1-016 | Complete | Host tools assigned to `apps/ui`; dashboard sponsor-only             | No separate host dashboard will be built                                                                                   |
| P1-017 | Complete | App middleware, D1 injection, auth mount, i18n, observability wiring | —                                                                                                                          |
| P1-018 | Partial  | Security hardening                                                   | DO limiter exists; CSP, WAF, Turnstile coverage, and endpoint audit remain                                                 |
| P1-019 | Partial  | Observability                                                        | Structured logs exist; Analytics dashboards and alerts remain                                                              |
| P1-020 | Partial  | Installable PWA                                                      | Manifest/service worker exist; offline, prerender, Lighthouse, and PWA Builder verification remain                         |
| P1-021 | Partial  | End-to-end tests                                                     | Current coverage is narrow and not part of CI                                                                              |
| P1-022 | Planned  | Browser-rendered OG images                                           | —                                                                                                                          |

### Immediate sequence

1. **P1-009/P0-018:** replace the one-minute notification scan with per-event Durable Object alarms feeding a real Notifications Queue; retain only a low-frequency recovery sweep and correct delivery to push-first/SMS-fallback.
2. **P1-008:** correct RSVP full-capacity atomicity and add a regression integration test against real D1.
3. **P0-007/P1-004/P0-019:** align market states, migrate legacy home-location column names to state/city codes, and finish dated deployment verification.
4. **P1-018:** complete Turnstile, WAF, CSP, and endpoint security coverage.
5. **P1-021:** add the critical member flow to Playwright and CI.
6. Continue sponsorship/admin/search/PWA launch work only after blockers 1–5 are cleared.

### P1 exit criteria

- urgent scheduler, RSVP, and security blockers resolved;
- production secrets, Email Sending, Access, and push/SMS delivery verified;
- full signup → create event → RSVP → notification → cancellation flow green in Playwright;
- RTL/LTR, offline PWA behavior, and performance budget verified;
- disclosed sponsorship surface and manual confirmation workflow live;
- Algiers meets the density gate.

## 6. Phase P2 — challenge engine

**Status: Planned.** Execute through [the challenge plan](./hackathon-engine-plan.md) after P1 exit. It remains feature-flagged and uses Workflows/DO alarms plus Queues for lifecycle work—never global D1 polling.

Deliver challenge creation, registration, teams, submissions, judging, results, integrity controls, and manual local-currency payouts. Community participation is free; commercial hosted challenges are paid B2B services.

## 7. Phase P3 — sponsorship and talent

**Status: Planned.** Execute through [the sponsorship measurement plan](./sponsorship-measurement-plan.md).

- `apps/dashboard` becomes the sponsor-only portal.
- Disclosed sponsorship, measurement, and reporting remain mandatory.
- Talent introductions require explicit, revocable participant consent.
- [The Projects proposal](./projects-feature-plan.md) is not committed scope.

## 8. Phase P4 — automated payments and expansion

**Status: Planned.** Automate DZ providers behind `PaymentProvider` only after compliance review. Advance EG or SA from `open` to `active` only after the density gate. MA and AE remain `dark` until geography and operational readiness exist.

## 9. Continuous gates

- Every change maps to a ticket and SRS requirement.
- Run `nx sync:check`, typecheck, lint, unit/integration tests, and relevant Playwright tests.
- Test Cloudflare bindings through Miniflare; provider-interface fakes are allowed only for external services or bindings Miniflare cannot emulate.
- Audit `ar`, `fr`, `en`, RTL/LTR, accessibility, security, performance, and observability per feature.
- Never promote `Partial` or `Blocked` work to `Complete` without evidence.
