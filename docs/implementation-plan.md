# Implementation Plan

## founders.coffee — current delivery plan (P0–P4)

| Field        | Value                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| Version      | 2.4                                                                                |
| Status       | Active                                                                             |
| Owner        | Engineering                                                                        |
| Last updated | 2026-09-03                                                                         |
| Derived from | [SRS v1.6](./srs.md) and [community-first release strategy](./release-strategy.md) |

This document is the current sequencing and status source. Status is evidence-based:

- **Complete** — implemented and verified for the ticket’s stated scope.
- **Partial** — useful implementation exists, but acceptance or operational work remains.
- **Blocked** — unsafe to call complete; a named defect or prerequisite must be resolved first.
- **Planned** — no production implementation yet.
- **Future** — intentionally outside the current release and blocked from active delivery until the community validation gate and explicit Founder / Product approval.

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
- The current release is community-building only: free local events, repeat participation, hosts,
  trust/moderation, and the PWA operations required to run that loop.
- Hackathons, sponsorship products, talent, payments, and expansion are future work. Existing
  foundations may remain, but none is a current launch requirement or an authorized next task.

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

| Capability             | Required architecture                                        | Current state                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions               | D1                                                           | Implemented                                                                                                                                                                                                                                                                                                    |
| Identity rate limiting | Durable Object + WAF; Better Auth may additionally use D1    | Partial; `RateLimiterDO` is bound and deployed to staging, and one active Free-plan zone rule covers auth and server-function paths in both environments. The remaining mutation audit belongs to P1-018                                                                                                       |
| Feature/config cache   | KV for idempotent reads only                                 | Planned, not bound                                                                                                                                                                                                                                                                                             |
| Event reminders        | DO alarms → Notifications Queue; low-frequency Cron recovery | **Blocked:** no DO alarm exists anywhere and `*/1 * * * *` D1 polling is still the primary scheduler. AR-02 stopped the sweep stranding rows, but did not change the scheduler                                                                                                                                 |
| PWA push               | FCM web push                                                 | Implemented in code; **not configured anywhere.** No `FIREBASE_*` secret is set on `apps/ui` or `apps/worker-jobs` in staging (verified 2026-09-02), so `getFirebaseConfig` returns `null` and `createPushProvider` returns `null`. Since AR-02 that is a terminal failure per row rather than a stalled sweep |
| SMS fallback           | Twilio Programmable SMS via `libs/notifications`             | Partial; the SMS-to-email fallback path works and is tested as of AR-02, but the producer still schedules SMS/email alongside push rather than on fallback                                                                                                                                                     |
| Authentication SMS     | Twilio Verify via `libs/auth`                                | Implemented; deployed environments must fail closed if credentials are absent                                                                                                                                                                                                                                  |
| Email                  | Cloudflare Email                                             | Code complete; sender-domain/DNS activation requires verification                                                                                                                                                                                                                                              |
| Search/AI              | Workers AI + Vectorize                                       | Foundations implemented; nonessential AI work is future and not a community-release blocker                                                                                                                                                                                                                    |
| Uploads                | R2 + Images                                                  | Provider foundation only; resources not bound                                                                                                                                                                                                                                                                  |
| Product metrics        | Analytics Engine                                             | Library foundation only; binding/dashboards planned                                                                                                                                                                                                                                                            |
| Admin isolation        | Access + in-Worker JWT verification + no `workers.dev`       | Worker guard complete and `workers_dev: false` verified live on staging (the `workers.dev` URL returns 404). `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are unset in staging, so every admin request fails closed with 403 — correct behaviour, but admin is non-functional there until they are configured   |

## 4. Phase P0 — foundation

| ID     | Status   | Scope                                                     | Remaining evidence or work                                                                                                                                                                                                                                        |
| ------ | -------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-001 | Partial  | Nx workspace, TypeScript, lint boundaries, Vitest         | Workspace, TypeScript, and Vitest are complete. Boundaries are not: no app carries a `layer:*` tag, so the layer constraints apply to no app, and `local/no-server-fns-in-components` does not cover `features/` — where one live violation sits. AR-09 and AR-12 |
| P0-002 | Complete | Public TanStack Start Worker                              | —                                                                                                                                                                                                                                                                 |
| P0-003 | Complete | Future sponsor dashboard scaffold                         | Dormant foundation; no community-release product UI                                                                                                                                                                                                               |
| P0-004 | Partial  | Admin Worker and Access JWT guard                         | Configure and verify Access in both environments                                                                                                                                                                                                                  |
| P0-005 | Complete | Core Result, AppError, Money, IDs, config                 | —                                                                                                                                                                                                                                                                 |
| P0-006 | Complete | D1/Drizzle schema, migrations, atomic helpers             | —                                                                                                                                                                                                                                                                 |
| P0-007 | Blocked  | Market configuration and geography                        | Change seed/config to DZ active, EG/SA open, MA/AE dark                                                                                                                                                                                                           |
| P0-008 | Partial  | Better Auth, phone/email OTP, OAuth, RBAC                 | Production must fail closed when Twilio/email providers are absent                                                                                                                                                                                                |
| P0-009 | Complete | Arabic-first `ar`/`fr`/`en` i18n and formatting           | —                                                                                                                                                                                                                                                                 |
| P0-010 | Complete | Shared Tailwind/DaisyUI design system                     | —                                                                                                                                                                                                                                                                 |
| P0-011 | Partial  | Typed resources and image-provider foundation             | Production R2/Images binding remains planned                                                                                                                                                                                                                      |
| P0-012 | Complete | Server-function throw boundary, context, authz primitives | —                                                                                                                                                                                                                                                                 |
| P0-013 | Complete | Shared Zod validation convention                          | —                                                                                                                                                                                                                                                                 |
| P0-014 | Partial  | Structured logging and metrics API                        | Analytics binding, dashboards, and alerts remain                                                                                                                                                                                                                  |
| P0-015 | Partial  | Future manual Order/Invoice payment foundation            | Dormant foundation; legacy cleanup is not a community-release blocker                                                                                                                                                                                             |
| P0-016 | Partial  | Cloudflare Email provider and templates                   | Verify sender-domain activation; complete production templates                                                                                                                                                                                                    |
| P0-017 | Complete | Future Workers AI/Vectorize foundation                    | No current work unless the community event loop demonstrates a concrete need                                                                                                                                                                                      |
| P0-018 | Blocked  | Jobs Worker                                               | AR-02 made the sweep resolve every row it selects, so delivery no longer stalls silently. Still blocked: reminder polling is unchanged, and **no queue is bound in any wrangler config**, so the `queue` consumer in `worker-jobs` is unreachable once deployed   |
| P0-019 | Partial  | Staging/production Cloudflare provisioning                | Verified in staging 2026-09-02: `apps/ui` has both Turnstile keys, Mapbox and Twilio; `admin`/`dashboard` have only `BETTER_AUTH_SECRET`. Missing: all `FIREBASE_*`, `CF_ACCESS_*`, `TWILIO_SMS_FROM`, and any Queue binding                                      |
| P0-020 | Partial  | GitHub Actions verification and environment deployments   | The dependency-audit gate is restored (AR-01) and a full staging deploy ran green on 2026-09-02 after an expired `CLOUDFLARE_API_TOKEN` was rotated. Remaining: the token has no rotation reminder, and migrations run before deploy with no shared rollback      |
| P0-021 | Partial  | Miniflare and Playwright harness                          | Critical-flow E2E remains a local/staging release gate; E2E is excluded from CI by current decision                                                                                                                                                               |

## 5. Phase P1 — community launch

| ID     | Status   | Scope                                                                | Remaining evidence or work                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-001 | Complete | Market resolution and visibility                                     | Align seed states under P0-007                                                                                                                                                                                                                                                                                                                                                                                      |
| P1-002 | Complete | Geo redirect, canonical market/city pages, empty states              | —                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P1-003 | Partial  | Email-OTP login UI, OAuth UI, and dormant phone-OTP capability       | Verify current email/OAuth production flow; keep unexposed phone endpoints fail-closed                                                                                                                                                                                                                                                                                                                              |
| P1-004 | Partial  | Geography datasets, onboarding, profiles                             | Profile persistence still uses legacy `home_state`/`home_city_id`; migrate to canonical state/city code names                                                                                                                                                                                                                                                                                                       |
| P1-005 | Complete | Event domain, repository, server functions                           | —                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P1-006 | Partial  | Event creation wizard and Mapbox venue selection                     | EC-01 through EC-07 complete. Continue EC-08 and EC-09; EC-10 release remains blocked on full staging smoke evidence, the production DNS/behavioral WAF check, and production credentials                                                                                                                                                                                                                           |
| P1-007 | Complete | Event feed/detail, virtualization, SEO metadata                      | Full prerender verification remains under P1-020                                                                                                                                                                                                                                                                                                                                                                    |
| P1-008 | Partial  | Immediate idempotent RSVP and cancellation                           | Full-capacity atomicity is fixed and proven by AR-04: a rejected RSVP writes nothing, a duplicate returns the typed `already_rsvpd`, and counter and attendee rows are asserted to agree. Remaining: `§10` requires Turnstile on RSVP and it is absent                                                                                                                                                              |
| P1-009 | Blocked  | PWA push primary, SMS fallback, email-specific delivery              | AR-02 delivered the reachable fallback and guaranteed terminal state. Still blocked: CO-02 owns alarms and the Queue, AR-03 gave it an atomic claim so overlapping sweeps no longer re-dispatch the window, and a dispatch marker so a crashed send is never silently repeated, AR-06 owns the `ar`/`fr`/`en` notification copy; CO-05/06/08 add idempotent host, attendee, correction, and did-not-happen delivery |
| P1-010 | Partial  | Live event Durable Object/WebSocket experience                       | Verify per-message session expiry, heartbeat cleanup, and cancellation behavior                                                                                                                                                                                                                                                                                                                                     |
| P1-011 | Future   | Disclosed sponsorship surfaces                                       | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                |
| P1-012 | Future   | Sponsor media through R2/Images                                      | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                |
| P1-013 | Planned  | Community moderation, host trust, and essential operations           | CO-04/08/09 build correlated admin auth, event operations, weekly review, corrections, trust, moderation, and audit                                                                                                                                                                                                                                                                                                 |
| P1-014 | Future   | Admin manual payment confirmation and audit                          | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                |
| P1-015 | Future   | Semantic event search                                                | Reconsider only when event density makes semantic search materially useful                                                                                                                                                                                                                                                                                                                                          |
| P1-016 | Complete | Host tools assigned to `apps/ui`; dashboard sponsor-only             | No separate host dashboard will be built                                                                                                                                                                                                                                                                                                                                                                            |
| P1-017 | Partial  | App middleware, D1 injection, auth mount, i18n, observability wiring | Public app wiring is complete; admin session/D1/i18n/observability wiring and correlated Access/Better Auth context remain under CO-04                                                                                                                                                                                                                                                                              |
| P1-018 | Partial  | Security hardening                                                   | Event creation has DO + Turnstile + an active shared Free-plan WAF rule. Other remaining tickets cover CSP/security headers, Turnstile on RSVP, anonymous metered map endpoints, and undeclared mutation permissions                                                                                                                                                                                                |
| P1-019 | Partial  | Observability                                                        | Structured logs and the first Analytics Engine metric (`events_created`, EC-08) exist; remaining product metrics, dashboards, and alerts remain                                                                                                                                                                                                                                                                     |
| P1-020 | Partial  | Installable PWA                                                      | Manifest/service worker exist; offline, prerender, Lighthouse, and PWA Builder verification remain                                                                                                                                                                                                                                                                                                                  |
| P1-021 | Partial  | End-to-end tests                                                     | EC-10 and CO-11 require local/staging release evidence; E2E remains outside CI by current decision                                                                                                                                                                                                                                                                                                                  |
| P1-022 | Future   | Browser-rendered OG images                                           | Optional future growth work; not a community-release blocker                                                                                                                                                                                                                                                                                                                                                        |
| P1-023 | Planned  | Community operations and retention loop                              | After EC-10, deliver CO-01 through CO-11 with RSVP freeze, closeout/attendance/feedback, weekly reviews, metrics, and feature-flagged launch                                                                                                                                                                                                                                                                        |

### Immediate sequence

Audit-remediation tickets are tracked in the
[Audit Remediation Plan](./audit-remediation-plan.md). Twelve are closed as of 2026-09-03: **AR-01**
through **AR-07** and **AR-09** through **AR-13**. Only **AR-08** remains open, and only its second
half — the security headers are enforced and the CSP is deployed in report-only mode, awaiting
report measurement before enforcement. Plan 1 is closed through **EC-08**. CI is green and staging
is deployed.

1. **Plan 1 — EC-09:** build the real-platform regression suite in the
   [Event Creation Remediation Plan](./event-creation-remediation-plan.md). EC-01 through EC-08 are
   complete: the shared creation contract, atomic persistence, the venue boundary, authorization and
   anti-abuse with a shared Free-plan WAF rule, the authenticated localized wizard, and the success,
   failure, cache and observability behavior. Do not complete EC-10 or begin Plan 2 production work
   before the remaining deployment, credential, production DNS/WAF behavior, and smoke gates are
   closed.
2. **Staging credentials, which gate EC-10.** Staging has no `FIREBASE_*`, no `CF_ACCESS_*` (admin
   fails closed with 403) and no `TWILIO_SMS_FROM`. EC-10 is a release gate that wants real
   delivery evidence, and the EC-08 staging log correlation, the AR-07 localized notifications and
   the AR-13 payload contract have never run against a real provider.
3. **AR-08's second half:** collect the report-only CSP reports now arriving at `/csp-report`, run
   the Playwright pass across `ar`/`fr`/`en`, thread script nonces through
   `router.options.ssr.nonce`, then set `CSP_ENFORCED=true`.
4. **Plan 2 — CO-01 immediately after EC-10:** begin the
   [Community Operations and Admin Implementation Plan](./community-operations-implementation-plan.md)
   with the operating contract and baseline.
5. **CO-02 / P0-018 / P1-009:** replace one-minute polling with per-event Durable Object alarms
   feeding a Notifications Queue, and bind that queue — no wrangler config binds one today, so the
   `queue` consumer in `worker-jobs` is unreachable once deployed.
6. **CO-03 through CO-11 / P1-013 / P1-017 / P1-019 / P1-023:** deliver closeout, attendance,
   feedback, repeat-host support, the secure correlated-identity admin surface, trust/moderation,
   weekly reviews, metrics, a real rollback flag, and three-checkpoint staged operations
   verification in the documented order.
7. **P0-007/P1-004/P0-019:** complete remaining market/home-location and dated deployment evidence
   where it blocks the community operations flow.
8. Complete only the moderation, trust, PWA, accessibility, performance, and operational work
   required to run the community reliably. Do not pull future sponsorship, challenge, talent,
   payment, or expansion work into this sequence.

### P1 exit criteria

- urgent scheduler, RSVP, and security blockers resolved;
- production secrets, Email Sending, Access, and push/SMS delivery verified;
- full signup → create event → RSVP → notification → pre-start cancellation flow green in Playwright;
- RTL/LTR, offline PWA behavior, and performance budget verified;
- essential event moderation and lightweight host-trust operations verified;
- RSVP intent frozen at event start; post-event prompts, closeout, attendance, feedback windows,
  admin identity correlation, weekly review records, and rollback behavior verified;
- held/did-not-happen correction side effects and bounded retention/anonymization verified;
- community release live and ready for the Algiers operating phase.

### Community validation gate

Technical P1 completion does not authorize P2–P4. After launch, operate the Algiers community until
it demonstrates at least eight completed events per month for three consecutive months, at least
three recurring hosts, at least 60% host retention, and evidence of healthy repeat participation.
Founder / Product must review that evidence and explicitly open any future phase. If the community
loop fails, prioritize fixing or reconsidering it instead of starting a later product layer.

## 6. Phase P2 — challenge engine (future)

**Status: Future.** This is not active or current-release scope. It may be reconsidered through [the challenge plan](./hackathon-engine-plan.md) only after the community validation gate and explicit Founder / Product approval. If opened, it remains feature-flagged and uses Workflows/DO alarms plus Queues for lifecycle work—never global D1 polling.

Deliver challenge creation, registration, teams, submissions, judging, results, integrity controls, and manual local-currency payouts. Community participation is free; commercial hosted challenges are paid B2B services.

## 7. Phase P3 — sponsorship and talent (future)

**Status: Future.** This is not active or current-release scope. Reconsider it only after the community validation gate and explicit Founder / Product approval, using [the sponsorship measurement plan](./sponsorship-measurement-plan.md) as research rather than authorization.

- `apps/dashboard` becomes the sponsor-only portal.
- Disclosed sponsorship, measurement, and reporting remain mandatory.
- Talent introductions require explicit, revocable participant consent.
- [The Projects proposal](./projects-feature-plan.md) is not committed scope.

## 8. Phase P4 — automated payments and expansion (future)

**Status: Future.** Payment automation and additional-market operations require the community validation gate, explicit Founder / Product approval, and the relevant compliance review. EG/SA configuration does not authorize operational expansion. MA and AE remain `dark` until geography and operational readiness exist.

## 9. Continuous gates

- Every change maps to a ticket and SRS requirement.
- Run `nx sync:check`, typecheck, lint, unit/integration tests, and relevant Playwright tests.
- Test Cloudflare bindings through Miniflare; provider-interface fakes are allowed only for external services or bindings Miniflare cannot emulate.
- Audit `ar`, `fr`, `en`, RTL/LTR, accessibility, security, performance, and observability per feature.
- Never promote `Partial` or `Blocked` work to `Complete` without evidence.
