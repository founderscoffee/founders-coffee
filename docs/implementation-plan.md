# Implementation Plan

## founders.coffee — current delivery plan (P0–P4)

| Field        | Value                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| Version      | 2.5                                                                                |
| Status       | Active                                                                             |
| Owner        | Engineering                                                                        |
| Last updated | 2026-09-14                                                                         |
| Derived from | [SRS v1.7](./srs.md) and [community-first release strategy](./release-strategy.md) |

This document is the current sequencing and status source. Status is evidence-based:

- **Complete** — implemented and verified for the ticket’s stated scope.
- **Partial** — useful implementation exists, but acceptance or operational work remains.
- **Blocked** — unsafe to call complete; a named defect or prerequisite must be resolved first.
- **Planned** — no production implementation yet.
- **Future** — intentionally outside the current release and blocked from active delivery until the community validation gate and explicit Founder / Product approval.

## 1. Canonical product and architecture decisions

- DZ is `active`; EG and SA are `open`; MA and AE are `dark`.
- This is the target market policy. The current seed/deployed rows still mark DZ/EG/SA `active`
  and omit MA/AE, so P0-007 remains blocked until configuration and deployed evidence agree.
- Expansion requires eight completed events per month for three consecutive months, three recurring hosts, and at least 60% host retention.
- D1 owns market configuration. Versioned TypeScript datasets own state/city reference data.
- Geographic records use `market_code`, `state_code`, and `city_code`.
- `apps/ui` owns member and host workflows; `apps/dashboard` is sponsor-only; `apps/admin` is internal operations.
- The installable Serwist PWA is the committed mobile surface. React Native/Expo is research only.
- PWA web push is the primary event-notification channel; email is the default fallback. SMS is
  reserved for same-day cancellations where an unread email could send someone to a venue unnecessarily.
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

| Capability             | Required architecture                                        | Current state                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions               | D1                                                           | Implemented                                                                                                                                                                                                                                                                                                                                                                      |
| Identity rate limiting | Durable Object + WAF; Better Auth may additionally use D1    | Partial; `RateLimiterDO` is bound and deployed to staging, and one active Free-plan zone rule covers auth and server-function paths in both environments. The remaining mutation audit belongs to P1-018                                                                                                                                                                         |
| Feature/config cache   | KV for idempotent reads only                                 | Planned, not bound                                                                                                                                                                                                                                                                                                                                                               |
| Event reminders        | DO alarms → Notifications Queue; low-frequency Cron recovery | CO-02 is deployed in staging and production. `NotificationScheduleDO` holds one alarm per event, publishes `notification_due` to the queue and rearms from D1; the cron is a fifteen-minute recovery sweep. `apps/ui` binds the class across scripts, so worker-jobs deploys first. See [deployment evidence](./deployment-evidence.md#current-operational-snapshot--2026-09-14) |
| PWA push               | FCM web push                                                 | Configured and proven on staging on 2026-09-10: the service worker ships/registers, FCM mints a session-linked token, and a real push opens the event route. Production credentials and delivery parity must be rechecked when the post-ND-07 code is promoted                                                                                                                   |
| Notification fallback  | Cloudflare Email; SMS for same-day cancellation only         | ND-07 is the active policy. Staging proves email fallback; the deployed production CO-02 version predates ND-07 and remains a promotion task. SMS consent is not a general reminder prerequisite                                                                                                                                                                                 |
| Authentication SMS     | Twilio Verify via `libs/auth`                                | Implemented; deployed environments must fail closed if credentials are absent                                                                                                                                                                                                                                                                                                    |
| Email                  | Cloudflare Email                                             | Code complete; sender-domain/DNS activation requires verification                                                                                                                                                                                                                                                                                                                |
| Search/AI              | Workers AI + Vectorize                                       | Foundations implemented; nonessential AI work is future and not a community-release blocker                                                                                                                                                                                                                                                                                      |
| Uploads                | R2 + Images                                                  | PF-06 is deployed with private per-environment R2 buckets and the Images transform binding; the buckets are currently empty. Ongoing free-tier usage and cleanup monitoring remain                                                                                                                                                                                               |
| Product metrics        | Analytics Engine                                             | Binding is active and the `events_created` metric is verified; community-health dashboards and alerts remain planned                                                                                                                                                                                                                                                             |
| Admin isolation        | Access + in-Worker JWT verification + no `workers.dev`       | Worker guard complete and `workers_dev: false` verified live on staging (the `workers.dev` URL returns 404). `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are unset in staging, so every admin request fails closed with 403 — correct behaviour, but admin is non-functional there until they are configured                                                                     |

## 4. Phase P0 — foundation

| ID     | Status   | Scope                                                     | Remaining evidence or work                                                                                                                                                                                                                                                                                                                        |
| ------ | -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-001 | Partial  | Nx workspace, TypeScript, lint boundaries, Vitest         | Workspace, TypeScript, and Vitest are complete. Boundaries are not: no app carries a `layer:*` tag, so the layer constraints apply to no app, and `local/no-server-fns-in-components` does not cover `features/` — where one live violation sits. AR-09 and AR-12                                                                                 |
| P0-002 | Complete | Public TanStack Start Worker                              | —                                                                                                                                                                                                                                                                                                                                                 |
| P0-003 | Complete | Future sponsor dashboard scaffold                         | Dormant foundation; no community-release product UI                                                                                                                                                                                                                                                                                               |
| P0-004 | Partial  | Admin Worker and Access JWT guard                         | Access applications and in-Worker JWT verification are configured; staging correlation is verified, while production operator setup and end-to-end verification remain                                                                                                                                                                            |
| P0-005 | Complete | Core Result, AppError, Money, IDs, config                 | —                                                                                                                                                                                                                                                                                                                                                 |
| P0-006 | Complete | D1/Drizzle schema, migrations, atomic helpers             | —                                                                                                                                                                                                                                                                                                                                                 |
| P0-007 | Blocked  | Market configuration and geography                        | Change seed/config to DZ active, EG/SA open, MA/AE dark                                                                                                                                                                                                                                                                                           |
| P0-008 | Partial  | Better Auth, phone/email OTP, OAuth, RBAC                 | Production must fail closed when Twilio/email providers are absent                                                                                                                                                                                                                                                                                |
| P0-009 | Complete | Arabic-first `ar`/`fr`/`en` i18n and formatting           | —                                                                                                                                                                                                                                                                                                                                                 |
| P0-010 | Complete | Shared Tailwind/DaisyUI design system                     | —                                                                                                                                                                                                                                                                                                                                                 |
| P0-011 | Partial  | Typed resources and image-provider foundation             | PF-06's R2/Images upload path and per-environment bindings are deployed; ongoing quota/cleanup monitoring and broader media consumers remain                                                                                                                                                                                                      |
| P0-012 | Complete | Server-function throw boundary, context, authz primitives | —                                                                                                                                                                                                                                                                                                                                                 |
| P0-013 | Complete | Shared Zod validation convention                          | —                                                                                                                                                                                                                                                                                                                                                 |
| P0-014 | Partial  | Structured logging and metrics API                        | Analytics binding, dashboards, and alerts remain                                                                                                                                                                                                                                                                                                  |
| P0-015 | Partial  | Future manual Order/Invoice payment foundation            | Dormant foundation; legacy cleanup is not a community-release blocker                                                                                                                                                                                                                                                                             |
| P0-016 | Partial  | Cloudflare Email provider and templates                   | Verify sender-domain activation; complete production templates                                                                                                                                                                                                                                                                                    |
| P0-017 | Complete | Future Workers AI/Vectorize foundation                    | No current work unless the community event loop demonstrates a concrete need                                                                                                                                                                                                                                                                      |
| P0-018 | Partial  | Jobs Worker                                               | CO-02 alarm/Queue scheduling is deployed to both environments and push/email delivery is proven on staging. Remaining work is production promotion of ND-07 and the outstanding provider/observability checks                                                                                                                                     |
| P0-019 | Partial  | Staging/production Cloudflare provisioning                | Use dated deployment evidence: staging/production Queue consumers and DLQs were added on 2026-09-04; current worker-jobs configuration declares TWILIO_SMS_FROM. Recheck secret/provider readiness for the selected CO/PF ticket; the older 2026-09-02 missing-binding snapshot is not current readiness evidence.                                |
| P0-020 | Partial  | GitHub Actions verification and environment deployments   | Format, sync, typecheck, lint, test, build, and Miniflare integration gates run in CI. The historical npm audit gate passed on 2026-09-02 but was removed on 2026-09-04 after npm's audit endpoint began returning registry errors; a working dependency-advisory replacement, token rotation reminder, and shared migration rollback remain open |
| P0-021 | Partial  | Miniflare and Playwright harness                          | Critical-flow E2E remains a local/staging release gate; E2E is excluded from CI by current decision                                                                                                                                                                                                                                               |

## 5. Phase P1 — community launch

| ID     | Status   | Scope                                                                | Remaining evidence or work                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | -------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-001 | Complete | Market resolution and visibility                                     | Align seed states under P0-007                                                                                                                                                                                                                                                                                                                                                                                                                           |
| P1-002 | Complete | Geo redirect, canonical market/city pages, empty states              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P1-003 | Partial  | Email-OTP login UI, OAuth UI, and dormant phone-OTP capability       | Verify current email/OAuth production flow; keep unexposed phone endpoints fail-closed                                                                                                                                                                                                                                                                                                                                                                   |
| P1-004 | Partial  | Geography datasets, onboarding, profiles                             | PF-01 through PF-12 in the [Profile and Account Management Plan](./profile-account-implementation-plan.md): remove home location, add editable opt-in public profiles and full account controls; preserve event geography                                                                                                                                                                                                                                |
| P1-005 | Complete | Event domain, repository, server functions                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P1-006 | Complete | Event creation wizard and Mapbox venue selection                     | EC-01 through EC-10 are signed off. Staging 18/18, production release/DNS/WAF evidence, and the authorized production creation smoke were verified by 2026-09-10.                                                                                                                                                                                                                                                                                        |
| P1-007 | Partial  | Event feed/detail, virtualization, SEO metadata                      | Canonical/OG URL inheritance, missing sitemap, cookie-only locale indexing, incomplete event/city metadata and structured data, crawlable utility routes, missing social images, and unverified TanStack Start prerender configuration are tracked in the [SEO Implementation Plan](./seo-implementation-plan.md) as SEO-01 through SEO-12. GEO-01 through GEO-05 are implemented and locally verified; full prerender verification remains under P1-020 |
| P1-008 | Partial  | Immediate idempotent RSVP and cancellation                           | Full-capacity atomicity is fixed and proven by AR-04: a rejected RSVP writes nothing, a duplicate returns the typed `already_rsvpd`, and counter and attendee rows are asserted to agree. Remaining: `§10` requires Turnstile on RSVP and it is absent                                                                                                                                                                                                   |
| P1-009 | Partial  | PWA push primary, email fallback, SMS same-day cancellation          | CO-02 is deployed; ND-01/ND-02 prove service-worker push and email fallback on staging. CO-06 and CO-07 add attendee follow-up and repeat-host support locally; production promotion and CO-08 host, correction, and operations delivery remain                                                                                                                                                                                                          |
| P1-010 | Partial  | Live event Durable Object/WebSocket experience                       | Verify per-message session expiry, heartbeat cleanup, and cancellation behavior                                                                                                                                                                                                                                                                                                                                                                          |
| P1-011 | Future   | Disclosed sponsorship surfaces                                       | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-012 | Future   | Sponsor media through R2/Images                                      | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-013 | Planned  | Community moderation, host trust, and essential operations           | CO-04 delivered the correlated admin auth shell and staging verification; CO-08/09 still own event operations, weekly review, corrections, trust, moderation, and audit                                                                                                                                                                                                                                                                                  |
| P1-014 | Future   | Admin manual payment confirmation and audit                          | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-015 | Future   | Semantic event search                                                | Reconsider only when event density makes semantic search materially useful                                                                                                                                                                                                                                                                                                                                                                               |
| P1-016 | Complete | Host tools assigned to `apps/ui`; dashboard sponsor-only             | No separate host dashboard will be built                                                                                                                                                                                                                                                                                                                                                                                                                 |
| P1-017 | Partial  | App middleware, D1 injection, auth mount, i18n, observability wiring | Public app wiring is complete; admin D1/i18n/observability/session wiring and correlated Access/Better Auth context are staging-verified under CO-04. Production CSRF-origin/operator verification remains                                                                                                                                                                                                                                               |
| P1-018 | Partial  | Security hardening                                                   | Event creation has the identity DO limiter and active shared Free-plan WAF rule; auth still has Turnstile. The event-create challenge was deliberately removed by the 2026-09-03 product decision, while RSVP Turnstile, anonymous metered map endpoints, and undeclared mutation permissions remain open                                                                                                                                                |
| P1-019 | Partial  | Observability                                                        | Structured logs and the first Analytics Engine metric (`events_created`, EC-08) exist; remaining product metrics, dashboards, and alerts remain                                                                                                                                                                                                                                                                                                          |
| P1-020 | Partial  | Installable PWA                                                      | Manifest/service worker exist; offline, prerender, Lighthouse, and PWA Builder verification remain                                                                                                                                                                                                                                                                                                                                                       |
| P1-021 | Partial  | End-to-end tests                                                     | EC-09/10 recorded 18/18 locally and on staging across ar/fr/en at 390/768/1280 on 2026-09-03; the authorized production creation smoke was verified on 2026-09-10. CO-11 remains, and E2E stays outside CI.                                                                                                                                                                                                                                              |
| P1-022 | Future   | Browser-rendered OG images                                           | Optional future growth work; not a community-release blocker                                                                                                                                                                                                                                                                                                                                                                                             |
| P1-023 | Partial  | Community operations and retention loop                              | CO-01 through CO-07 are implemented locally; CO-02/CO-03 are deployed to both environments, CO-04/CO-05 are staging-verified, and CO-06/CO-07 are locally verified. Staging/production promotion and CO-08 through CO-11 evidence remain                                                                                                                                                                                                                 |
| P1-024 | Partial  | SEO discoverability and search-engine operations                     | SEO-01 through SEO-11 and GEO-01 through GEO-05 are implemented and locally or staging verified. Remaining SEO-12 Search Console operations stay tracked in the [SEO Implementation Plan](./seo-implementation-plan.md)                                                                                                                                                                                                                                  |

### Immediate sequence

Audit-remediation tickets are tracked in the
[Audit Remediation Plan](./audit-remediation-plan.md). AR-02 through AR-07 and AR-09 through AR-13
are complete for the public Worker. AR-01's historical `npm audit` gate was removed from CI on
2026-09-04 after registry errors and needs a working replacement. AR-08's CSP and secure headers
were enforced in staging and production on 2026-09-04; `apps/admin` remains report-only because its
Access-gated origin still needs an authenticated measurement. The later [deployment evidence](./deployment-evidence.md)
records CSP enforcement, Queue consumers, the EC release and the Round Table redesign. This is
documentary evidence, not a new live CI or infrastructure certification.

1. **Plan 1 — EC-10 final handoff:** the
   [Event Creation Remediation Plan](./event-creation-remediation-plan.md) records EC-01 through
   EC-10 complete, 18/18 staging cases on 2026-09-03, three persisted events and cleanup. Production
   v0.1.0 and DNS/WAF verification followed on 2026-09-04. The authorized production creation smoke
   was performed and verified on 2026-09-10, so the EC handoff is signed off. Do not repeat the
   superseded staging mailbox or production DNS blockers.
2. **Provider readiness for CO/PF:** verify current deployed secrets and real channel delivery
   when the relevant ticket begins. Existing provider interfaces or bound consumers do not prove
   delivery. EC-08's staging request/metric correlation is recorded; that does not certify all
   notification providers or the future account-management flows.
3. **CSP regression:** preserve the enforced policy declared in current staging/production UI
   configuration and recorded in the v0.2.0/v0.3.0 release evidence. New profile/photo behavior must
   pass the same policy; no return to report-only mode is authorized by this plan.
4. **Plan 2 — CO-01 immediately after EC-10:** begin the
   [Community Operations and Admin Implementation Plan](./community-operations-implementation-plan.md)
   with the operating contract and baseline.
5. **CO-02 / P0-018 / P1-009:** deployed to staging and production. Per-event Durable Object alarms
   feed the environment-specific Notifications Queue, the cron is a fifteen-minute recovery sweep,
   and member preferences are enforced at send time. Staging proves push-first with email fallback;
   production still needs the post-ND-07 release promotion. See the dated deployment snapshot.
6. **CO-03 through CO-11 / P1-013 / P1-017 / P1-019 / P1-023:** deliver closeout, attendance,
   feedback, repeat-host support, the secure correlated-identity admin surface, trust/moderation,
   weekly reviews, metrics, a real rollback flag, and three-checkpoint staged operations
   verification in the documented order.
7. **P0-007/P1-004/P0-019:** complete remaining market configuration and dated deployment evidence
   where it blocks the community operations flow. P1-004 now owns the
   [Profile and Account Management Plan](./profile-account-implementation-plan.md), PF-01 through
   PF-12: remove profile residence and deliver member profile/account controls. This lane preserves
   the EC → CO priority above; notification, retention and moderation integration depend on the
   named CO tickets rather than duplicating them. No home-code renaming project remains required.
8. Complete only the moderation, trust, PWA, accessibility, performance, and operational work
   required to run the community reliably. Do not pull future sponsorship, challenge, talent,
   payment, or expansion work into this sequence.

### P1 exit criteria

- urgent scheduler, RSVP, and security blockers resolved;
- production secrets, Email Sending, Access, and push/email delivery verified;
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

**Status: Future.** This is not active or current-release scope. It may be reconsidered only after the
community validation gate and explicit Founder / Product approval. If opened, it remains
feature-flagged and uses Workflows/DO alarms plus Queues for lifecycle work—never global D1 polling.

Deliver challenge creation, registration, teams, submissions, judging, results, integrity controls, and manual local-currency payouts. Community participation is free; commercial hosted challenges are paid B2B services.

## 7. Phase P3 — sponsorship and talent (future)

**Status: Future.** This is not active or current-release scope. Reconsider it only after the community
validation gate and explicit Founder / Product approval; no future sponsorship implementation is
authorized by this roadmap.

- `apps/dashboard` becomes the sponsor-only portal.
- Disclosed sponsorship, measurement, and reporting remain mandatory.
- Talent introductions require explicit, revocable participant consent.
- A standalone project showcase is not committed scope.

## 8. Phase P4 — automated payments and expansion (future)

**Status: Future.** Payment automation and additional-market operations require the community validation gate, explicit Founder / Product approval, and the relevant compliance review. EG/SA configuration does not authorize operational expansion. MA and AE remain `dark` until geography and operational readiness exist.

## 9. Continuous gates

- Every change maps to a ticket and SRS requirement.
- Run `nx sync:check`, typecheck, lint, unit/integration tests, and relevant Playwright tests.
- Test Cloudflare bindings through Miniflare; provider-interface fakes are allowed only for external services or bindings Miniflare cannot emulate.
- Audit `ar`, `fr`, `en`, RTL/LTR, accessibility, security, performance, and observability per feature.
- Never promote `Partial` or `Blocked` work to `Complete` without evidence.
