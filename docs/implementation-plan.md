# Implementation Plan

## founders.coffee — current delivery plan (P0–P4)

| Field        | Value                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| Version      | 3.0                                                                                |
| Status       | Active                                                                             |
| Owner        | Engineering                                                                        |
| Last updated | 2026-09-29                                                                         |
| Derived from | [SRS v1.7](./srs.md) and [community-first release strategy](./release-strategy.md) |

This document is the current sequencing and status source. Status is evidence-based:

- **Complete** — implemented and verified for the ticket’s stated scope.
- **Partial** — useful implementation exists, but acceptance or operational work remains.
- **Blocked** — unsafe to call complete; a named defect or prerequisite must be resolved first.
- **Planned** — no production implementation yet.
- **Future** — intentionally outside the current release and blocked from active delivery until the community validation gate and explicit Founder / Product approval.

## 1. Canonical product and architecture decisions

- DZ, EG, and SA are the only configured markets, and all three are `active`.
- MA and AE are removed from the market configuration. Migration `0029_activate_launch_markets`
  aligns existing rows; `SEED_MARKETS` keeps fresh local/test environments on the same policy.
- Expansion requires eight completed events per month for three consecutive months, three recurring hosts, and at least 60% host retention.
- D1 owns market configuration. Versioned TypeScript datasets own state/city reference data.
- Geographic records use `market_code`, `state_code`, and `city_code`.
- `apps/ui` owns member and host workflows; `apps/dashboard` is sponsor-only; `apps/admin` is an
  Arabic-only RTL internal operations console.
- The installable Serwist PWA is the committed mobile surface. React Native/Expo is research only.
- A session travels only in Better Auth's HttpOnly cookie, so its bearer plugin is off. Left on, it
  took the bare session token, which sits in D1 and which `get-session` returns to page scripts, as
  a login from anywhere. A non-web client, once approved, brings it back with
  `requireSignature: true`, and the device controls learn to read the header in the same change.
- PWA web push is the primary event-notification channel; email is the default fallback. SMS is
  reserved for same-day cancellations where an unread email could send someone to a venue unnecessarily.
- Per-entity reminders use Durable Object alarms feeding a Notifications Queue. Cron is recovery-only.
- Every meetup has a chat on founders.coffee, created with it: its host and everyone going are its
  members, and nobody else reads or writes in it (P1-026, decided 2026-09-29). It replaces the
  meetup Telegram groups of P1-025 (#15), which ran through the official Telegram Bot API: a bot
  cannot create a group, so each host had to bring one. CH-12 retired them on 2026-10-01, ahead of
  the chat opening in production (Founder / Product). WhatsApp was ruled out on 2026-09-29: its
  Groups API needs an Official Business Account and holds eight people.
- TypeScript 6, public base locales `ar`/`fr`/`en`, Arabic-only RTL admin copy, and shared Zod
  validation are canonical.
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
| Identity rate limiting | Durable Object + WAF; Better Auth may additionally use D1    | Partial; `RateLimiterDO` is bound and deployed in both environments, and one active Free-plan zone rule covers auth, server-function, client-log and CSP report paths in both, at 50 requests per 10 seconds per address. Sign-in codes spend a sender and a mailbox budget after Turnstile; Better Auth's own limiter is off. The remaining mutation audit belongs to P1-018    |
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
| Telegram groups        | Retired (CH-12)                                              | Removed from the code on 2026-10-01. Migration 0044 drops their tables once it is promoted from `libs/db/pending-migrations/`; the meetup chat (P1-026) replaces them                                                                                                                                                                                                            |
| Meetup chat            | Durable Object per meetup (hibernating WebSockets) + D1      | Planned; see [Meetup chat](#meetup-chat-p1-026)                                                                                                                                                                                                                                                                                                                                  |

## 4. Phase P0 — foundation

| ID     | Status   | Scope                                                          | Remaining evidence or work                                                                                                                                                                                                                                                                       |
| ------ | -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0-001 | Complete | Nx workspace, TypeScript, lint boundaries, Vitest              | All applications carry explicit layer tags, Nx module-boundary constraints are active, `local/no-server-fns-in-components` guards `components/`, `lib/`, and `features/`, and Istanbul coverage gates run for `libs/domain` and `libs/server-fns`. P0-001 enforcement and regression tests pass. |
| P0-002 | Complete | Public TanStack Start Worker                                   | —                                                                                                                                                                                                                                                                                                |
| P0-003 | Complete | Future sponsor dashboard scaffold                              | Dormant foundation; no community-release product UI                                                                                                                                                                                                                                              |
| P0-004 | Complete | Admin Worker and Access JWT guard                              | Access applications, in-Worker JWT verification, production operator setup, and end-to-end correlation are verified under the deployment evidence                                                                                                                                                |
| P0-005 | Complete | Core Result, AppError, Money, IDs, config                      | —                                                                                                                                                                                                                                                                                                |
| P0-006 | Complete | D1/Drizzle schema, migrations, atomic helpers                  | —                                                                                                                                                                                                                                                                                                |
| P0-007 | Complete | Market configuration and geography                             | Migration `0029_activate_launch_markets` and the seeded policy are verified in staging and production: exactly DZ/EG/SA are present and all three are `active`; MA/AE are absent                                                                                                                 |
| P0-008 | Complete | Better Auth, phone/email OTP, OAuth, RBAC                      | Production authentication, provider fail-closed behavior, and the public login flow are verified                                                                                                                                                                                                 |
| P0-009 | Complete | Public Arabic-first `ar`/`fr`/`en` i18n; Arabic-only admin RTL | —                                                                                                                                                                                                                                                                                                |
| P0-010 | Complete | Shared Tailwind/DaisyUI design system                          | —                                                                                                                                                                                                                                                                                                |
| P0-011 | Partial  | Typed resources and image-provider foundation                  | PF-06's R2/Images upload path and per-environment bindings are deployed; ongoing quota/cleanup monitoring and broader media consumers remain                                                                                                                                                     |
| P0-012 | Complete | Server-function throw boundary, context, authz primitives      | —                                                                                                                                                                                                                                                                                                |
| P0-013 | Complete | Shared Zod validation convention                               | —                                                                                                                                                                                                                                                                                                |
| P0-014 | Partial  | Structured logging and metrics API                             | Analytics binding, dashboards, and alerts remain                                                                                                                                                                                                                                                 |
| P0-015 | Partial  | Future manual Order/Invoice payment foundation                 | Dormant foundation; legacy cleanup is not a community-release blocker                                                                                                                                                                                                                            |
| P0-016 | Complete | Cloudflare Email provider and templates                        | Branded OTP/notification templates, right-aligned RTL content, localized copyright footer, named sender (`Founders Coffee <no-reply@founders.coffee>`), and the 30-minute email OTP expiry are deployed and verified                                                                             |
| P0-017 | Complete | Future Workers AI/Vectorize foundation                         | No current work unless the community event loop demonstrates a concrete need                                                                                                                                                                                                                     |
| P0-018 | Partial  | Jobs Worker                                                    | CO-02 alarm/Queue scheduling is deployed to both environments and push/email delivery is proven on staging. Remaining work is production promotion of ND-07 and the outstanding provider/observability checks                                                                                    |
| P0-019 | Complete | Staging/production Cloudflare provisioning                     | Staging and production Worker deployments, D1/R2/Email/DO/Queue bindings, queues and DLQs, provider secrets, and sender configuration are provisioned. Production admin login with the shared UI Turnstile credentials passed on 2026-09-16; Twilio credentials were rotated on 2026-10-03.      |
| P0-020 | Complete | GitHub Actions verification and environment deployments        | Format, sync, typecheck, lint, test, build, Miniflare integration, migration compatibility, rollback-state capture, Worker deployment, production SEO smoke, and release publication are green in production. `rollback.yml` refuses Worker versions the manifest cannot clear.                  |
| P0-021 | Partial  | Miniflare and Playwright harness                               | Critical-flow E2E remains a local/staging release gate; E2E is excluded from CI by current decision                                                                                                                                                                                              |

## 5. Phase P1 — community launch

| ID     | Status   | Scope                                                                | Remaining evidence or work                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | -------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-001 | Complete | Market resolution and visibility                                     | Resolution logic and deployed market-row alignment are verified under P0-007                                                                                                                                                                                                                                                                                                                                                                             |
| P1-002 | Complete | Geo redirect, canonical market/city pages, empty states              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P1-003 | Partial  | Email-OTP login UI, OAuth UI, and dormant phone-OTP capability       | Verify current email/OAuth production flow; keep unexposed phone endpoints fail-closed                                                                                                                                                                                                                                                                                                                                                                   |
| P1-004 | Partial  | Geography datasets, onboarding, profiles                             | PF-01 through PF-12 in the [Profile and Account Management Plan](./profile-account-implementation-plan.md): remove home location, add editable opt-in public profiles and full account controls; preserve event geography                                                                                                                                                                                                                                |
| P1-005 | Complete | Event domain, repository, server functions                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P1-006 | Complete | Event creation wizard and Mapbox venue selection                     | EC-01 through EC-10 are signed off. Staging 18/18, production release/DNS/WAF evidence, and the authorized production creation smoke were verified by 2026-09-10.                                                                                                                                                                                                                                                                                        |
| P1-007 | Partial  | Event feed/detail, virtualization, SEO metadata                      | Canonical/OG URL inheritance, missing sitemap, cookie-only locale indexing, incomplete event/city metadata and structured data, crawlable utility routes, missing social images, and unverified TanStack Start prerender configuration are tracked in the [SEO Implementation Plan](./seo-implementation-plan.md) as SEO-01 through SEO-12. GEO-01 through GEO-05 are implemented and locally verified; all pages are rendered by the Worker, since #104 |
| P1-008 | Partial  | Immediate idempotent RSVP and cancellation                           | Full-capacity atomicity is fixed and proven by AR-04: a rejected RSVP writes nothing, a duplicate returns the typed `already_rsvpd`, and counter and attendee rows are asserted to agree. RSVP is session-bound, so it uses authz and rate limiting without a browser Turnstile challenge                                                                                                                                                                |
| P1-009 | Partial  | PWA push primary, email fallback, SMS same-day cancellation          | CO-02 is deployed; ND-01/ND-02 prove service-worker push and email fallback on staging. CO-06 and CO-07 add attendee follow-up and repeat-host support locally; production promotion and CO-08 host, correction, and operations delivery remain                                                                                                                                                                                                          |
| P1-010 | Partial  | Live event Durable Object/WebSocket experience                       | Verify session expiry (checked at each heartbeat alarm, so within 45 s, and before each state-changing message), heartbeat cleanup, and cancellation behavior                                                                                                                                                                                                                                                                                            |
| P1-011 | Future   | Disclosed sponsorship surfaces                                       | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-012 | Future   | Sponsor media through R2/Images                                      | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-013 | Planned  | Community moderation, host trust, and essential operations           | CO-04 delivered the correlated admin auth shell and staging verification; CO-08/09 still own event operations, weekly review, corrections, trust, moderation (the meetup chat's report review included, moved from CH-08), and audit                                                                                                                                                                                                                     |
| P1-014 | Future   | Admin manual payment confirmation and audit                          | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-015 | Future   | Semantic event search                                                | Reconsider only when event density makes semantic search materially useful                                                                                                                                                                                                                                                                                                                                                                               |
| P1-016 | Complete | Host tools assigned to `apps/ui`; dashboard sponsor-only             | No separate host dashboard will be built                                                                                                                                                                                                                                                                                                                                                                                                                 |
| P1-017 | Complete | App middleware, D1 injection, auth mount, i18n, observability wiring | Production admin correlation, session wiring, and CSRF-origin verification are recorded under P0-004/P1-017                                                                                                                                                                                                                                                                                                                                              |
| P1-018 | Partial  | Security hardening                                                   | Event creation has the identity DO limiter and the shared Free-plan WAF rule; public auth/waitlist operations keep Turnstile, and a sign-in code spends a sender and a mailbox DO budget (2026-10-03). Session-bound mutations need no browser challenge; remaining work covers anonymous metered map endpoints and undeclared mutation permissions; `/client-logs` and `/csp-report` each spend a per-address DO budget; WAF covers both (2026-10-02)   |
| P1-019 | Partial  | Observability                                                        | Structured logs and the first Analytics Engine metric (`events_created`, EC-08) exist; remaining product metrics, dashboards, and alerts remain; not-found lines log at `info` without a stack, browser error reports carry their page's path, and `/client-logs` validates every entry (2026-10-02)                                                                                                                                                     |
| P1-020 | Partial  | Installable PWA                                                      | Manifest/service worker exist; offline, Lighthouse, and PWA Builder verification remain                                                                                                                                                                                                                                                                                                                                                                  |
| P1-021 | Partial  | End-to-end tests                                                     | EC-09/10 recorded 18/18 locally and on staging across ar/fr/en at 390/768/1280 on 2026-09-03; the authorized production creation smoke was verified on 2026-09-10. CO-11 remains, and E2E stays outside CI.                                                                                                                                                                                                                                              |
| P1-022 | Future   | Browser-rendered OG images                                           | Optional future growth work; not a community-release blocker                                                                                                                                                                                                                                                                                                                                                                                             |
| P1-023 | Partial  | Community operations and retention loop                              | CO-01 through CO-07 are implemented locally; CO-02/CO-03 are deployed to both environments, CO-04/CO-05 are staging-verified, and CO-06/CO-07 are locally verified. Issue #107 adds the city waitlist launch outbox and localized email path; staging/production promotion and CO-08 through CO-11 evidence remain                                                                                                                                       |
| P1-024 | Partial  | SEO discoverability and search-engine operations                     | SEO-01 through SEO-11 and GEO-01 through GEO-05 are implemented and locally or staging verified. Remaining SEO-12 Search Console operations stay tracked in the [SEO Implementation Plan](./seo-implementation-plan.md). Market landing pages name each market's country in hreflang (`ar-DZ` to `en-SA`), with bare languages and `x-default` on Algeria's, and `og:locale` follows the market (2026-09-29); robots.txt refuses Awario (2026-10-02)     |
| P1-025 | Retired  | Meetup Telegram groups through the Bot API                           | Deployed with v0.14.0 and on in production since v0.15.0 (`@FoundersCoffeeBot`); production held no connected group on 2026-09-29. Replaced by the meetup chat (P1-026, 2026-09-29) and retired by CH-12 on 2026-10-01, ahead of the chat opening in production (Founder / Product)                                                                                                                                                                      |
| P1-026 | Planned  | Meetup chat for the host and everyone going                          | CH-01 through CH-12 in [Meetup chat](#meetup-chat-p1-026); its decisions were confirmed on 2026-09-29                                                                                                                                                                                                                                                                                                                                                    |

### City waitlist notice (#107)

Every published meetup opens a notice round for its market and city while somebody there is still
waiting, in one conditional insert, so a meetup nobody waits for writes nothing. Rounds are per
meetup rather than per city because the waitlist form comes back whenever a city has no upcoming
meetup, and whoever joins then is owed the next one. Each entry receives one notice: a partial unique
index allows a single pending, in-flight or sent notice per entry, and a notice that fails for good,
or whose meetup is cancelled first, leaves the entry for the next meetup. An entry already told
about a meetup that is then cancelled is not told again: the email promises it is the only one, and
that promise holds (decided 2026-09-27).

The Notifications Queue worker writes a round's notices in chunks under D1's 100-parameter limit,
claims them in batches of 50, and hands the round back to the queue at once for the next batch or
after the one- and five-minute back-offs. A notice that may have reached the provider is never
resent. The message is rendered once per language through the shared notification email helpers
(market time zone, canonical event URL, French city articles). A meetup cancelled or started before
its notice goes out withdraws the round, and the fifteen-minute recovery sweep carries any round
whose message never arrived.

Retention runs in the daily cron: entries notified more than twelve months ago are deleted through
the partial index on `notified_at`, the narrow indexed sweep AGENTS.md §11.5 allows since #106 was
decided on 2026-09-27. The migration is `0037_city_waitlist_launches.sql`; Miniflare coverage lives
in `libs/db/src/waitlist-*.test.ts`, `libs/server-fns/src/events/waitlist-launch.test.ts` and
`apps/worker-jobs/src/jobs/waitlist-launch*.test.ts`. Deploy `worker-jobs` before `ui`, so the
consumer knows `waitlist_launch_due` before the first one is sent; the recovery sweep delivers any
round either way.

### Account closure (#105)

A member closes their account by writing to contact@founders.coffee, as the privacy policy says,
and the operator follows the [account requests runbook](./account-requests.md): check that the
request comes from the account's address, then set `account_state = 'closing'` and `closed_at`,
which takes the profile and the meetups the member hosts out of every public read at once, and
delete their sessions. Signing in again does not reopen the account; only the operator can, until
the erasure.

The daily cron carries each closing account through (`libs/server-fns/src/profile/account-closure.ts`).
It cancels the meetups the member hosts that have not started, through the host's own cancellation
so everyone going is told, and gives back their seats at other hosts' meetups. A meetup of theirs
under way makes it wait for a later night. Then it deletes their photos from R2 and erases the account in one D1 batch (`libs/db/src/account-closure.ts`).

The erasure keeps the `user` row as a tombstone instead of deleting it: no name, phone, photo or
language, and an address under `.invalid`. Every foreign key that blocked a delete keeps pointing at
it and nothing cascades, so the host's meetups and every other member's RSVPs, attendance and
feedback on them stay, as the policy promises. The member's own RSVPs and attendance stay for their
24 months, and their feedback ratings without the comment. Everything else that was theirs goes,
including the rows keyed by their address: sign-in codes and waitlist entries. Every statement
re-checks that the account is still closing, and the tombstone is written last, so an account
reopened in between is left as it was.

An erased host's published meetups keep their page, their place in attendees' lists, their share
card and their sitemap entry, with no name and no profile link (`visibleHost` in
`libs/db/src/profile-access.ts`). Discovery, the host's history and the counts still leave them out,
and a banned host's meetups stay hidden, erased or not. The job reads closing accounts through the
partial index `user_closing_index`, twenty a night, the retention-sweep shape AGENTS.md §11.5
allows. An account still waiting 25 days after closure logs `account_closure_overdue` as an error,
ahead of the policy's 30 days.

The issue proposed running the erasure from the admin app. It runs from `worker-jobs` instead,
because the admin app has no mutations, rate limiter or R2 binding yet (CO-08/CO-09). Export
requests (PF-09) are the runbook's second part: read-only queries and the photo original, sent to
the account's address. Neither request has a button on the account screen yet. Orders and invoices,
from the dormant payments work, are not touched by the erasure; that must change before payments
open. The migration is `0038_account_closure.sql`. Miniflare coverage lives in
`libs/db/src/account-closure*.test.ts`, `libs/db/src/events.moderation.test.ts`,
`libs/server-fns/src/profile/account-closure.test.ts` and the daily-run test in
`apps/worker-jobs/src/index.test.ts`.

### Public profile (P1-004)

The public profile answers one question: should I show up to coffee with this person? It is not a
portfolio.

**What it shows.** The display name, photo, and introduction are public whenever they are set. So
are, with no toggle, the month the account was created, because an account age its owner could hide
would say nothing to the person deciding whether to meet them, and the day and time never leave the
server (#89); and how many meetups the member hosted in the last two years that their closeouts say
took place, because hosting is already public in the list of meetups they ran (#26). Everything else
is published only by its own toggle, and every toggle starts off: what the member is building, as
one line of up to 80 characters, and how far along it is, as `idea`, `building`, or `launched`
(#89); interests; spoken languages; a personal website; and how many meetups the member attended in
the last two years (#90). Clearing a field withdraws its publication.

**The meetup record.** Both counts come from closeouts and include only meetups whose closeout says
they took place. Attendance is what hosts recorded at closeout, and a no-show is never counted or
shown. A meetup that did not happen is left out rather than counted against anybody, and the record
never sets a total beside a count, though the list of meetups a host ran still shows its own. In
that list, every meetup the hosted count includes is tagged as having taken place, so the count is
the number of tagged meetups. A meetup without the tag is upcoming, was never closed out, was
reported as not happening, or is older than the window, and nothing says which (#26). Attendance is
a count and not a list, because a list would publish where someone was; #91's tabs stay deferred for
the same reason. The window is the operations retention period, 730 days measured on each meetup's
start, and the profile says "in the last two years": closeouts and attendance are deleted at that
age, so a longer claim would shrink as they retire.

**What it will not become.** Features that are neutral on a hiring network are not neutral for
members meeting strangers in DZ, EG, and SA. These boundaries change only through an explicit
decision about member safety, never as a side effect of a growth or SEO ticket (#92):

1. **The profile stays `noindex`.** Public means reachable with the link, not on the open web:
   `/u/$userId` keeps `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`.
2. **No followers or following.** A follower graph publishes who knows whom, which cannot be
   withdrawn once seen, and ranks people by popularity.
3. **No direct messages.** Messages from a cold profile are a harassment surface, so a profile
   offers no way to write to its owner. Member-to-member contact goes through a shared event. As
   decided on 2026-09-29, that is the meetup's chat (P1-026): the host and the people going talk
   there before and after, nobody else can read it, there is no private thread between two
   members, and a member who cancels leaves it. The meetup Telegram groups (P1-025, #15), which did
   this job too and let members message each other on Telegram, were retired by CH-12 on
   2026-10-01.
4. **No resume, employers, or verified credentials.** This is not a hiring product.
5. **No public posts or feed.** Moderating them across three countries and three languages serves no
   part of the core question.
6. **No no-show counts, ratios, or reliability scores.** `event_attendance` records no-shows, and
   none of it is published: a profile shows positive counts only, never a denominator.
7. **Social proof attaches to events, not people.** Nothing rates a person.
8. **No trust status.** A market's verdict on a host, `host_trust` (`unreviewed`, `verified` or
   `restricted`), stays an operations decision and never appears on the profile: a verified mark
   would be a moderator's rating of a person, and a restricted one a public blacklist. What the
   platform can vouch for is already there, as the hosted count and its tags (decided 2026-09-24,
   #26).

### Meetup chat (P1-026)

Decided on 2026-09-29: every meetup gets a chat on founders.coffee, created with it. Its host and
everyone going are its members automatically, and nobody else can read or write in it. It replaces
the Telegram groups of P1-025. A bot cannot create a Telegram group, so each host had to bring one,
and a host without one met an empty chat list in Telegram and could not finish. WhatsApp was ruled
out the same day: its Groups API needs an Official Business Account and holds eight people. The
chat is built the way the live room (P1-010) is, one hibernating WebSocket Durable Object per
meetup, with D1 as the record.

**First release.** Text only: one line of up to 1,000 characters, with `http` and `https`
addresses shown as links that open in a new tab (`rel="noopener noreferrer nofollow ugc"`). A
member can delete their own message, and the host any message in their meetup's chat. Not in it:
attachments, reactions, replies, editing, typing indicators, read receipts, search, direct
messages, email per message, and city-wide channels. A channel names its `kind` so a city channel
can come later, but `meetup` is the only kind.

**Decisions**, confirmed by Founder / Product on 2026-09-29:

1. **How long it stays open.** From publication until seven days after the meetup ends, then
   read-only. A cancelled meetup's chat turns read-only at the cancellation.
2. **How long it is kept.** Messages are deleted 90 days after the meetup ends or is cancelled.
3. **History.** A member sees the whole chat, including what was said before they RSVPed. A member
   who cancels loses access at once, and gets it back, history included, if they RSVP again. RSVPs
   freeze when the meetup starts, so its members are fixed from then on.
4. **Notifications.** At most one pending push per member per chat, sent two minutes after the
   first message they have not read, with neutral text ("New messages in {title}") so no message
   shows on a lock screen. A member can mute a chat. No email.
5. **Moderators.** A moderator reviewing a report reads the whole chat it was posted in, for
   context. Only a report opens a chat to them, and each opening is audited.
6. **Telegram.** P1-025 is retired by CH-12, which Founder / Product brought forward on 2026-10-01,
   ahead of the chat opening in production. Production has no group feature in between; it held
   no connected group on 2026-09-29.
7. **Language.** Messages carry no language code and are shown as written, the exception
   AGENTS.md §9 makes for profile introductions. CH-05 added chat messages to it.
8. **Where it opens.** In a panel over the meetup page, not a page of its own: full width on phones
   and tablets, and from `lg` a side panel on the end side, with the meetup dimmed behind it.

**Membership.** One predicate decides it for every read, write and socket. The reader is the
meetup's host, by `events.host_id` rather than the host's own RSVP, which is written best-effort.
Or the reader has an `event_rsvps` row for the meetup: only `going` is ever written there, and a
cancellation deletes the row. Either way their account must be active and not banned, through the
`activeProfileIdentity` seam in `libs/db/src/profile-access.ts`; the chat checks this itself rather
than trusting the RSVP. The meetup must still stand by its host, through `visibleHost`, the rule its
page keeps: a banned host's chat closes to everyone, and an erased host's stays with the people
going. Nothing is written when someone joins, because the RSVP is the membership: that is how
everyone going joins automatically, and how a cancellation removes them.

**Lifecycle.** A meetup and its chat are written together. `createEventIfRouteAvailable` becomes a
batch whose second statement inserts the channel from the new meetup's row, so a meetup whose
address was taken writes neither, and migration 0041 backfills a channel for every existing meetup
still inside the 90 days. The channel keeps `read_only_at` (seven days after the end, or the
cancellation) and `expires_at` (90 days after either), so the retention sweep reads an index. One
SQL expression in `libs/db` derives both from the meetup's row, taking a meetup with no end as two
hours long (`ASSUMED_DURATION_SECONDS`), and the backfill, `updateEventIfCurrent` and
`transitionEventStatus` each run it in the batch of their own write, so a lost version race or a
wrong status changes neither. A send's batch inserts the channel too, writing nothing when it
exists, so a meetup that a Worker older than 0041 published during the deploy gets its chat with its
first message. Once the meetup ends, the chat's header says until when it stays open, and once it is
read-only it says so. Both come from `read_only_at`, so no job has to post them.

**Data model** (`libs/db`, migration 0041, which also moves the release pin in
`tools/deploy/release-state.test.mjs`):

- `chat_channels`: `id` (`chn_…`), `kind` (`meetup`), `event_id` (unique, cascades with the
  meetup), `market_code` (a meetup never changes market; its city is read from the meetup),
  `read_only_at`, `expires_at` (indexed), `created_at`, `updated_at`.
- `chat_messages`: `id` (`msg_…`), `channel_id` (cascades), `author_id` (null for a system
  message), `kind` (`text` or `system`), `body` (empty for a system message or a removed one),
  `system_key` and `system_params` (JSON) for a system message, `client_id` (unique with
  `channel_id` and `author_id`, so a retried send writes once and an id reused in another chat is
  a new message there), `created_at` in milliseconds, `removed_at`, `removed_by`, `removal`
  (`author`, `host` or `moderator`). Indexed on `(channel_id, created_at, id)`. Authors' names and
  photos are joined at read time, never copied into a message.
- `chat_members`: only what a member chooses, keyed by `(channel_id, user_id)` and written the
  first time they open the chat: `last_read_at`, `muted`, `updated_at`.
- `chat_reports`: `id` (`rpt_…`), `message_id` (no cascade: a report outlives its message),
  `reporter_id` (unique with `message_id`, so a member reports a message once),
  `reported_user_id` (the message's author, 0043), `market_code`, `reason` (`spam`, `harassment` or
  `other`), `created_at`, `status`, `reviewed_by`, `reviewed_at` (partial index, for retention).

The Zod schemas and the pure rules (normalising a body, finding its links, whether a chat is open
or read-only) live in `libs/domain/src/chat`, and the stored values in `libs/core`'s enums, as
ENUM-01 set out.

**Sending and reading** (`libs/server-fns/src/chat`). Every server function declares a permission
on a new `chat` resource (`read`, `write`) in `libs/auth/src/rbac.ts`, held by members, hosts,
moderators and admins, and every change spends a budget in a new `RATE_BUDGETS.chat` category
(`rate-budgets.test.ts` pins the category set).

- `sendChatMessage({ eventId, body, clientId })`: one `INSERT … SELECT … WHERE` that writes only
  when the sender is a member and the chat is open, with
  `ON CONFLICT (channel_id, author_id, client_id) DO NOTHING`. The room then broadcasts the stored
  message. About 20 a minute per member.
- `listChatMessages({ eventId, before, after, limit })`: members only, pages of up to 50 on a
  `(created_at, id)` cursor; `after` fills the gap after a reconnect.
- `removeChatMessage({ messageId })`: by its author or the meetup's host. It empties the body and
  leaves a tombstone. A moderator's removal is the admin app's (see Moderation).
- `markChatRead({ eventId, at })` and `setChatMuted({ eventId, muted })`.
- `reportChatMessage({ messageId, reason })`.
- `getChatPage({ eventId })`: what the panel reads when it opens. The channel, the membership, the
  last 50 messages with their authors' names and photos, and the member's read marker, in one trip
  to D1 after the session's, held to that by a test that counts the resolver's calls to D1.

**Real time.** `EventChatDO`, one per meetup named `chat:${eventId}`, SQLite-backed under a new
`new_sqlite_classes` tag in `apps/ui/wrangler.jsonc`, exported from `apps/ui/src/server.ts`, and
created with the `weur` location hint. The class lives in `libs/server-fns/src/chat`, as
`RateLimiterDO` lives in `libs/server-fns`, so the server functions' own Miniflare tests reach the
room they tell; `server.ts` re-exports it.

- The Worker routes `GET /api/chat/:eventId` with `Upgrade: websocket` beside `/api/live/` in
  `server.ts`, reading the meetup from the path the way `liveRoomEventId` does since 1d774c91: 404
  for any other path, 405 with `Allow: GET` for another method, 426 without the upgrade. It checks
  `Sec-Fetch-Site` and `Origin` (raw routes sit outside TanStack Start's CSRF middleware;
  `photo-http.ts` is the precedent), spends a connect budget, and forwards to the room. The route
  is `handleChatSocketRequest` in `socket-http.ts`, as the photo route is `photo-http.ts`, and the
  budget, 30 connections in ten minutes, is counted against the signed-in member, or against the
  address of anyone else, so members sharing a café's network do not share one.
- The room reads the session cookie and admits members only. It shares the live room's session,
  membership and heartbeat code, moved out of `durable-objects/event-live/` into a module both
  rooms use rather than copied: `libs/server-fns/src/rooms`, which the live room imports as
  `@founders-coffee/server-fns/rooms`, with the heartbeat's frames and timings in
  `libs/core/src/rooms.ts` for the pages too. Each room brings its own membership query and its own
  words for a refusal. The chat's asks `isChatMember` of every session in one statement
  (`readChatSocketSessions`), so the socket keeps the one rule every read and write keeps.
- Sockets hibernate: `acceptWebSocket`, the user id in `serializeAttachment`, the runtime answering
  the 15-second heartbeat, stale sockets reaped after 45 seconds, and access checked again at each
  heartbeat alarm, as the live room does. A member holds at most five sockets: a sixth makes their
  oldest give way, closed as superseded, which its page takes as a reason to stop reconnecting.
- The room only pushes: `message`, `removed`, `closed`, `revoked`. It ignores every frame but the
  heartbeat. What a member sends goes through a server function, so validation, authorisation,
  rate limits and logs stay in one place. A `message` frame is the view the server functions answer
  with, made for each member, so only its author gets the client id back. The close codes are
  `CHAT_ROOM_CLOSES` in `libs/core`: 4001 for no session, with no frame, 4003 after `revoked`, 4004
  after `closed` and 4005 for a superseded socket, beside the rooms' 4002 for a heartbeat timeout
  and 1013 for a database that could not answer while a socket joined.
- Server functions reach the room through Durable Object RPC methods (`broadcast`, `revoke`,
  `close`) rather than HTTP requests, as the live room's `cancel()` has since 1d774c91. A send, a
  retried one too, broadcasts the stored message and a removal its tombstone; a failure to reach
  the room is reported and costs nothing written.
- `cancelRsvpResolver` calls `revoke` once the seat is given back, and `revoke` asks D1
  whether that member still belongs rather than taking the caller's word, so the host, whose own
  RSVP never made them a member, keeps their sockets. `cancelEventResolver` calls `close`.
- The jobs Worker has no binding to the rooms, and the nightly account closure cancels meetups
  there, so a room also closes itself (Founder / Product, 2026-09-30, rather than binding the jobs
  Worker across scripts). The membership query reads whether the chat has turned read-only, which a
  cancellation does at once, and a room whose chat has tells every socket `closed` and closes it
  with 4004 at the next heartbeat alarm, within 45 seconds, whichever Worker cancelled. A page that
  joins a read-only chat is closed the same way at once, and so is every socket a week after the
  meetup, when the chat turns read-only with time. The live room reads its meetup's status in its
  own query and closes for a cancellation the same way, with `event_cancelled`. The closing member
  was turned out already, when their account began closing. The heartbeat check is also what
  catches a ban, which no server function tells the room.
- The client hook, `useEventChat`, follows `useEventLive`: backoff from 1 to 30 seconds, a fetch
  `after` its newest message on every connect, duplicates dropped by id. After three failed
  connects in a row it polls `listChatMessages` every 15 seconds while the panel is open.

**System messages** are stored as a key and parameters and read in each member's language.
`rescheduled` and `relocated` come from `announceUpdate` in
`events/update-notices.ts`, where `noticeFor` already decides that a new time wins over a new place
and that a place moves at 100 metres. `cancelled`, with the reason, comes from
`cancelEventResolver` in `events/cancel.ts`: the resolver, not its server function, so the
cancellations the nightly account closure makes post it too. Reminders stay push and email.
A notice is written in one batch that gives a meetup with no chat its chat, only where the market
has switched chats on, and into a cancelled chat although the cancellation has just made it
read-only. The room pushes it to the open panels, before it closes them on a cancellation, and a
failure is reported without undoing the edit or the cancellation. The jobs Worker has no room, so
a panel open when the nightly closure cancels reads the notice once the room closes itself at its
next heartbeat check. A key or parameters a screen cannot read show as a change to the meetup.

**Notifications and unread.**

- A notification kind, `chat_unread`, and a preference category, `meetup_chat`, added through the
  steps every kind takes (enum, templates, matrix, destination gate), with migration 0042 for the
  category's two columns in `account_preferences`. By decision 4 it is push only and on by
  default, and its row in the preferences grid shows only where the device can take a push, and
  only once some market has switched the chat on: an account belongs to no market, so the
  preferences read asks whether any has (`isChatSwitchedOnAnywhere`), and a hidden row's saved
  choice goes back unchanged with every save (component tests and Miniflare D1, 2026-09-30). It
  stays out of the union of categories that a notice with no category of its own follows: it
  arrived switched on, and counting it would start those notices again for a member who had
  turned the rest off.
- The send's own batch queues the notices, in one `INSERT … SELECT` that runs only when that
  attempt wrote the message, so a retry queues nothing. Each other member gets one if they have
  push on, the category on and the chat not muted, and have no notice pending for the chat and
  none unread since their last: one push per unread stretch (Founder / Product, 2026-09-30). It is
  due two minutes later, and `armNotificationSchedule` wakes the meetup's schedule for it, as
  `host-notice.ts` does, only when a notice was queued. At dispatch, the destination gate drops it
  if the member has read past it, muted the chat, turned the category off or left the chat. Its
  words are neutral, in the member's language; the push is tagged per chat (`dedupeKey`), and
  opening it opens the meetup with its chat panel open.
- A system message pushes nothing and counts as nothing unread, and the panel's New messages
  divider waits for a message someone wrote.
- The meetup page's chat entry shows the unread count in a daisyUI `badge`, 99+ past 99, and says
  it in words to a screen reader. The activity list shows a daisyUI `status` dot. Both read
  `getChatUnreadCounts`, a private query of its own, as `useMyCloseoutStates` is, because the
  hosted list is the public profile's query too: it counts only the reader's own chats, up to 100
  meetups at a time. The entry's count waits while the panel is open, and a move of the read
  marker has it read again once the panel closes.
- Mute is a bell in the panel's header beside the close button, a toggle button (`aria-pressed`).
  A muted chat still shows its count; it sends no push.

**Moderation.**

- Reports went by email through `/contact#report`; the chat brings the first in-app report. CH-08
  is the members' side: an options button beside each message opens a dialog over the panel, to
  delete your own message, to report anyone else's with a reason (spam, harassment or something
  else), and for the host to remove anyone's as well. Deleting and removing ask first. The
  reporter stays anonymous, as the community guidelines promise and the dialog says, and a
  member's second report of a message is kept as the first. Each runs under a `RATE_BUDGETS.chat`
  budget, and a removal reaches every open panel through the room at once.
- The review is the admin app's, part of its moderation work (CO-09; Founder / Product,
  2026-09-30): each market's open chat reports, each opening the whole chat it came from with the
  reported message marked, to remove or dismiss, behind the Access guard and a new `message`
  action on the `moderation` resource, which moderators and admins hold. Every decision, and every
  opening of a chat, writes `operations_audit` through `auditStatement`, with new `chat_message`
  target and action values added with the code that emits them. The admin Worker reaches neither a
  rate limiter nor the chat rooms today, so that work also decides how it does. Until it lands,
  reports wait in `chat_reports`, which only the database shows, and the chat's flag stays off
  (CH-11).
- A removed message keeps its tombstone and records who removed it.
- A banned or closing member loses the chat through the membership predicate, and their name reads
  as a neutral "Member" once their profile is no longer visible. When CO-09 replaces the
  `profile-access.ts` seam, the chat follows it.

**Privacy, retention and erasure.**

- The privacy policy has a meetup chat section and a retention row, in `privacy-data.ts`,
  `privacy-processing.ts` and `privacy-rights.ts` (Arabic, authoritative), `legal-en-privacy.ts`
  and `legal-fr-privacy.ts`. It says what is kept (the message, its time and its author, the read
  marker and the mute), who sees it (the host and the people going, with the author's name and
  photo, and a moderator reviewing a report, who reads the whole chat it was posted in), for how
  long (90 days after the meetup ends or is cancelled), what a report keeps and for how long, and
  that messages are not end-to-end encrypted. The host still has no way to message a member
  privately. Its wording holds before the flag is on and in a market without it ("a gathering can
  have a chat"). `privacy-practice.test.ts` holds its 90 days and 24 months to the constants in
  `libs/core/src/chat.ts`, which the database's lifetime expressions and the sweep read.
- The community guidelines apply in meetup chats and say how to report a message in the app; the
  terms' "Reporting a violation" names the in-app report; the organizer terms send a host with
  something to tell the people going to the chat as well as the description, and forbid offers in
  it as in the description. Privacy, guidelines, terms and organizer terms are dated 30 September
  2026 in every language.
- **Notice.** Privacy §12 promises advance notice of a material change in what is collected or who
  receives it, and the chat is both. Once the staging run has passed, every active account is
  emailed, in its language, what the chat keeps and who reads it, with a link to the policy,
  whatever its notification settings, since this is the notice the policy promises rather than a
  notification. The flag goes on in production a week later (CH-11; Founder / Product,
  2026-09-30). Nothing emails every member yet: every notice belongs to a meetup
  (`scheduled_notifications.event_id` is required), and the city waitlist's emails have an outbox
  of their own. CH-11 adds a send list the same way, which the jobs worker drains a batch at a
  time with retries. A migration fills it, so the release that carries it sends the email, to
  staging's test accounts first.
- **Retention.** The daily run in `apps/worker-jobs` (`0 3 * * *`) deletes expired chats the way
  the waitlist sweep deletes entries, under the AGENTS.md §11.5 exception: by id from a bounded
  subselect on the `expires_at` index, 500 at a time and at most ten passes a night; messages and
  read and mute settings cascade. Reports hold no copy of the message and outlive their chat. Each
  keeps the id of the member whose message it is (`reported_user_id`, migration 0043), so a member
  reported again and again still shows after the chats are gone, and is deleted by the same run 24
  months after its decision, through a partial index on `reviewed_at`; an open report waits for its
  decision (Founder / Product, 2026-09-30).
- **Export.** The operator runbook, `docs/account-requests.md`, has queries for the member's own
  messages, chat settings and the reports they filed. Reports about their messages stay out: in a
  small meetup, a report's date and reason can point to who made it.
- **Erasure.** `eraseClosedAccount` deletes the member's messages and chat settings in its batch,
  under the same still-closing guard, as it clears feedback comments. Reports they filed and the
  ones about their messages stay, pointing at the tombstone. The room keeps no names or messages in
  its storage, so erasure has nothing to reach there.

**Screens** (`apps/ui/src/features/chat`).

- **Meetup page.** For the host and people going, a chat entry in `RsvpSection.tsx` and
  `HostEventPanel.tsx`: the unread count and an Open chat button
  that opens the panel. On an upcoming meetup, everyone else reads that the people going talk
  there.
- **Chat panel.** A native `<dialog>` with daisyUI's `modal modal-end`, opened with `showModal()`
  from the meetup page as `ProfileMenuDrawer` does: full width below `lg`, and from `lg` about
  28rem wide on the end side (left in Arabic, right in English), the meetup dimmed behind. Its top
  layer keeps it above the sticky navbar, focus moves into it and stays out of the page behind,
  and Escape closes it. daisyUI's checkbox `drawer` does none of the three: in a prototype of
  2026-09-29 the navbar covered its top bar, Tab went through the page behind first, and Escape
  left it open. The panel is `100dvh` tall rather than daisyUI's `100vh`, so the composer stays
  above Safari's toolbar, and it follows the visual viewport when the keyboard opens, checked on a
  real iPhone on staging. The meetup's title and a close button sit on top; the composer sits at
  the bottom with safe-area padding.
- **Its address.** The open panel is a search parameter the meetup route validates, `?chat`:
  opening it adds a history entry, so Back closes it, and a push opens the meetup with it open. A
  signed-out reader is offered sign-in, which returns to the same address, and anyone else sees
  the meetup with the panel closed. The meetup page stays public and indexed: its canonical link
  ignores the query, and the panel's data comes from its own query once it opens, never from the
  route's loader or the server-rendered HTML. Its code is split out too, so the page keeps its one
  trip to D1 (#114) and does not grow for readers who never open the chat.
- **Messages.** daisyUI's `chat` (5.6.13 follows the page's direction through logical properties
  and `[dir=rtl]`). Others' messages are `chat-start`, with an avatar in the `HostFace` style and
  their name and time above; your own are `chat-end` and `chat-bubble-primary`. System messages
  are centred lines, not bubbles, and a removed message is a muted line. Day separators and an
  unread divider. The bubble keeps the page's direction and the text sits in `<bdi>`, the meetup
  page's rule. In Arabic, the header and footer step up from daisyUI's 11px as `.eyebrow` does.
- **The list** is `role="log"` with `aria-live="polite"`, virtualised with TanStack Virtual at
  variable heights (the `CloseoutRoster` precedent), loads older pages at the top with
  `useInfiniteQuery`, and follows new messages only while the reader is at the bottom, without
  smooth scrolling under reduced motion.
- **Composer.** One rounded frame holding a borderless `input input-sm md:input-md` and a
  `btn btn-primary btn-xs sm:btn-sm md:btn-md` Send button, as the share dialog's copy-link row
  does, so the frame sets the row's height at every width: below `sm` a button is 24px and a field
  32px, and neither may be resized. Enter sends; the button is disabled with a spinner while
  sending, and a message that fails stays in the list with Retry. It is not a textarea: daisyUI's
  `.textarea` is at least 5rem tall, and the control-size rule does not let a page lower it.
- **States.** Loading, error with Retry, empty, read-only, reconnecting and offline.
- **The panel and the message dialog** are native `<dialog>`s, which `dialog-contract.test.ts`
  finds and holds to the app's dialog rules on its own. The message dialog opens over the panel
  from a message's options button, beside its bubble: shown on hover or focus with a mouse, and
  always on a touch screen.
- **Copy** in all three languages: «محادثة اللقاء», « Discussion », "Chat", with entries in
  `libs/i18n/glossary.json` so each language keeps one word for it.

**Observability.** Every chat server function and the room log through `libs/observability` with
the market and request, never a message's text. Analytics Engine counts messages sent, chats with
at least one message and members who read one, per market and city, beside the community-health
metrics of P1-019.

**Rollout.** A `meetupChat` market feature flag in `MarketFeatureFlags`, read as JSON `true` inside
the membership predicate, so every read, write and socket is gated by it without asking for it
separately, and switching it off closes every chat in the market at once. It is in place, off, from
CH-03 on, since the chat's server functions deploy before its moderation and privacy work does; the
test and local seeds turn it on. While it is off everywhere nothing of the chat shows, its row in
the notification settings included. CH-11 turns it on in all three markets at once (Founder /
Product, 2026-09-30):

- **Staging** gets it from a one-off command, run with Founder / Product's OK, for the evidence
  run. Not from a migration: migrations run on every deploy, so one on `develop` would open the
  chat in production with the next release, whatever the run had found.
- **Production** gets it from a migration, in a release a week after the members' notice. It
  reaches staging too, where it changes nothing.

Staging can run the whole feature.

**Retiring Telegram groups (CH-12).** Founder / Product brought it forward on 2026-10-01, ahead
of CH-10 and CH-11, so production has no group feature until the chat opens there.

- The 61 files with `telegram` in their path are gone, and so is the Telegram code in the files
  they shared with the rest of the app: the webhook route in `server.ts`, the four server
  functions, the five Telegram rate budgets, the `telegram` delivery channel with its eight
  template keys and payload fields, the providers in `libs/notifications`, the calls in the
  meetup, RSVP and account-closure paths, the 33 `telegram_*` and `ntf_telegram_*` messages in
  each language, and `TELEGRAM_BOT_USERNAME` in production `vars`. Migration 0036 stays, as
  history.
- `0044_retire_telegram_groups` drops `event_telegram_groups` and `event_telegram_invites` and
  deletes the Telegram rows left in `scheduled_notifications`. Every release before this one reads
  those tables, and the deploy refuses an irreversible migration, so it waits in
  `libs/db/pending-migrations/`. Promoting it is a release step once this release is live on
  staging and production: record the deployed Worker versions, a D1 recovery point and the
  rollback version, move the file unchanged into `libs/db/migrations/`, declare it `irreversible`
  in `compatibility.json`, and apply it through the worker-jobs config. Until then every new
  migration waits behind it, CH-11's included. A Telegram row still queued meanwhile has no
  dispatcher, so the sweep resolves it as failed.
- The privacy policy's Telegram parts are gone in each language, dated 1 October 2026, and
  `privacy-practice.test.ts` holds the policy to describing no Telegram group. The runbook's
  Telegram queries and this plan's Telegram section are gone.
- Left to the operator: call `deleteWebhook`, delete `TELEGRAM_BOT_TOKEN` from both Workers and
  `TELEGRAM_WEBHOOK_SECRET` from the UI Worker, and delete the bot in BotFather if wanted. Until the
  webhook is deleted, Telegram's updates reach a route that no longer exists.

The share-to-Telegram link (`share-targets.ts` and the share dialog) is not part of P1-025 and
stays.

| ID    | Status   | Scope                                                                                                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CH-01 | Complete | This plan                                                                                                                        | Decisions 1 to 8 confirmed by Founder / Product on 2026-09-29                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CH-02 | Partial  | Migration 0041 and its backfill, the channel written with each meetup, domain schemas, repositories with single-statement writes | On Miniflare D1 (2026-09-29): the backfill gives each meetup inside its 90 days one channel, with the lifetime publishing gives; a meetup whose address was taken writes no channel; repository tests for sends, pages, removals, read markers and reports. The count on staging waits for the next deploy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CH-03 | Complete | Server functions, the `chat` permission, the `chat` budgets                                                                      | On Miniflare D1 (2026-09-29): a non-member, a cancelled RSVP, a banned member and a read-only chat are refused; a retried send writes once; `getChatPage` reads in one batch after the session's. The `meetupChat` flag gates every chat read and write, off on staging and production until CH-11                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CH-04 | Complete | `EventChatDO`, the socket route, the rooms' shared session code                                                                  | Through `worker.fetch` on Miniflare (2026-09-29): a foreign `Origin`, a `POST` and a non-member are refused; a cancelled RSVP is revoked; stale sockets are reaped; a hibernated room wakes and pushes. The live room's 32 integration tests pass on the shared code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CH-05 | Partial  | Meetup page entry, `useEventChat`, the chat panel and its address, messages, composer, every state                               | Component tests for the entry, the panel and its gating, every state, messages, the composer, the outbox, the socket and the read marker (2026-09-30). `meetup-chat.spec.ts` passes locally in ar at 390, fr at 768 and en at 1280: a signed-out reader signs in and comes back to the panel, the host and a member each see the other's messages arrive live, a link opens in a new tab, the panel fills a phone and a tablet and sits on the end side from `lg`, and Back, Escape and the close button close it. The keyboard on a real iPhone waits for the flag on staging (CH-11). Remove and Report are CH-08's. `meetup-chat-lifecycle.spec.ts` passes (2026-09-30): an RSVP opens the chat and cancelling closes it, a new RSVP brings the history back, others see only the invite line, and an ended meetup's chat says until when, then turns read-only   |
| CH-06 | Complete | System messages                                                                                                                  | On Miniflare D1 and Durable Objects (2026-09-30): a new start, a new place with its address, both at once as one new start, a quiet edit as nothing, a cancellation with its reason and without one, posted once however often it is made and pushed to an open panel before the room closes it, a market with the chat off told nothing, and the nightly account closure's cancellation left in the chat for the people going. Component tests for each notice in ar, fr and en, its values isolated. `meetup-chat.spec.ts` ends with the host cancelling and passes locally in ar at 390, fr at 768 and en at 1280: the member's open panel reads the cancellation and its reason in their language and turns read-only                                                                                                                                            |
| CH-07 | Partial  | `chat_unread`, the `meetup_chat` preference, unread counts                                                                       | On Miniflare D1 (2026-09-30): a send queues one notice for each other member with push on, in their language, two minutes out, and none for its author, a retry, a muted or banned member, a member with the category off, or one whose last notice is pending or unread since; the dispatcher sends it tagged per chat and drops it for a member who has read, muted, switched the category off or left. The counts read only the reader's own chats, and 0042 keeps every choice a member had made. Component tests for the badge, the mute, the activity dot and the preferences row. `meetup-chat.spec.ts` passes locally in ar at 390, fr at 768 and en at 1280: the host's entry counts the message written while their panel was closed, reading it clears the count, and a mute holds across a reload. A push received on staging waits for the flag (CH-11) |
| CH-08 | Partial  | Delete, Remove and Report in the chat panel                                                                                      | Component tests for the options on each message, the dialog's steps, reasons and failures, and its Escape, which leaves the panel open; the tombstone written into the panel's cache (2026-09-30). The writes and their server functions are CH-02's and CH-03's, tested there. `meetup-chat.spec.ts` passes locally in ar at 390, fr at 768 and en at 1280: the member reports the host's message with a reason, which is kept for the market, the host removes the member's and the member deletes their own, each seen at once in the other's panel. The review is the admin app's (see Moderation); step 6 on staging waits for the flag (CH-11)                                                                                                                                                                                                                 |
| CH-09 | Partial  | Privacy policy, guidelines and terms, export, erasure, retention sweep                                                           | On Miniflare D1 (2026-09-30): the sweep deletes a chat 90 days after its meetup with its messages and settings, keeps a younger one and the reports of a deleted one, deletes a report 24 months after its decision and never an open one, reading both through their indexes; a report keeps who it is about, even once that account is deleted outright; erasure deletes a closed account's messages and settings and no one else's, keeps both kinds of report, and leaves a reopened account's chat as it was. `privacy-practice.test.ts` holds the policy's 90 days and 24 months to the code. The policy, guidelines, terms and organizer terms are dated 30 September 2026 in ar, fr and en; their review waits for Founder / Product                                                                                                                         |
| CH-10 | Planned  | Logs, metrics and budgets                                                                                                        | Waits for the admin app (Founder / Product, 2026-09-30). Sends and the panel's first read within 300 ms p95 on staging by the Worker's `wallTime`; no message text in any log                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CH-11 | Planned  | The staging run, the members' notice, then the flag on in production a week later                                                | The run below recorded on staging, the notice sent, then the flag on in production a week later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CH-12 | Partial  | Retiring Telegram groups, brought forward ahead of CH-10 and CH-11 (Founder / Product, 2026-10-01)                               | Code, messages and privacy text removed on 2026-10-01, and P1-025's row records the retirement. Left: promoting migration 0044 once this release is live everywhere, and the operator's webhook and secrets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Tickets run in number order. Moderation and privacy (CH-08 and CH-09) come before the flag, since
the chat cannot open to members without them. The flag also waits for the admin app's review of
reports, so that a report reaches someone who can act on it, and CH-10 waits for the admin app
too, so CH-10 and CH-11 come after it (Founder / Product, 2026-09-30). CH-12 came forward, ahead of
both, on 2026-10-01 (Founder / Product).

**Evidence run** (staging, its flag set by the one-off command, with a host, a member and a third
account):

1. The host publishes a meetup. It has a chat, empty.
2. The member RSVPs. The chat entry appears, and the two talk in real time in two browsers, one in
   Arabic and one in English.
3. The third account sees the line about the chat but not the chat. At the meetup's `?chat` address
   it gets the meetup with the panel closed, and the socket refuses it.
4. The host moves the time, then the place: each posts a system message. The member cancels: their
   socket closes and the entry goes. They RSVP again and are back, history included.
5. With the member's chat closed, the host writes. About two minutes later the member's push
   arrives; it opens the meetup with the panel open, which clears the count. Muting stops the next
   one.
6. The member reports a message. A moderator opens the chat from the report in the admin app, the
   audit records the opening, and the moderator removes the message. The host removes another; the
   member deletes their own. Each change shows at once in the other's open panel.
7. On a meetup that has ended, the header says until when the chat stays open; with its
   `read_only_at` moved into the past on staging's D1, the chat is read-only. A second meetup,
   cancelled, posts its cancellation and turns read-only at once.
8. With `expires_at` moved into the past, the next nightly run deletes the chat and its messages.

Record the date, the commit and each step's result under this section.

### Enum contract consolidation

The enum audit identified repeated finite-value declarations across the core, database, domain,
server-function, worker, and UI layers. These tickets consolidate active contracts without changing
stored values or runtime behavior. Core owns values shared by persistence and delivery boundaries;
domain owns feature-specific input contracts. Dynamic market/geography codes, provider identifiers,
routes, HTTP values, i18n keys, and UI/protocol/infrastructure-only state remain scoped to their
owning module.

| ID      | Status   | Scope                                                                                                                                                                | Remaining evidence or work                                                                                                                                     |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENUM-01 | Complete | Establish canonical `as const` arrays, inferred unions, and Zod schemas in `libs/core`                                                                               | Targeted and Nx-wide typecheck/lint/build verification passes; stored values and runtime behavior are unchanged                                                |
| ENUM-02 | Complete | Replace duplicate locale, lifecycle, notification, push, venue-kind, profile-asset, operations, and DB contracts with canonical imports and compatibility re-exports | Targeted and Nx-wide typecheck/lint/build verification passes; stored values and runtime behavior are unchanged                                                |
| ENUM-03 | Complete | Finish domain-owned contracts for notification categories, account providers, and venue categories with reusable schemas and boundary imports                        | Targeted domain/server typecheck, lint, and tests pass; provider IDs, routes/protocol values, and UI-only states remain intentionally scoped                   |
| ENUM-04 | Complete | Establish core-owned contracts for transient RSVP, waitlist, attendance, closeout, feedback, prompt, notification-dispatch, and operations-error outcomes            | Core outcome schemas and guards are covered by Vitest; stored values and runtime behavior are unchanged                                                        |
| ENUM-05 | Complete | Adopt the ENUM-04 contracts in D1 repositories, server functions, and notification jobs, keeping compatibility exports and documenting intentional local unions      | DB, server-fns, and worker-jobs typechecks and tests pass; UI/protocol/infrastructure state and dynamic identifiers remain local by design                     |
| ENUM-06 | Complete | Remove the remaining duplicated profile-photo variant and test-harness locale declarations where a shared contract is appropriate                                    | UI photo URLs reuse the domain variant; E2E and UI integration suites reuse the core locale contract; test matrices and SEO tooling remain intentionally local |

### Tooling and documentation closure

| ID      | Status   | Scope                                                                                                         | Evidence                                                                                                                                                                                          |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TOOL-01 | Complete | Keep Nx project-graph evaluation independent of generated i18n output while retaining NodeNext source imports | `apps/ui` config-time sitemap metadata imports the canonical leaf locale contract; clean graph, Nx-wide typecheck/lint, public build, i18n/UI tests, and server-fns tests pass                    |
| TOOL-02 | Complete | Keep the format gate independent of generated inlang output while still checking the tracked `settings.json`  | `.prettierignore` mirrors inlang's `.gitignore`; after a clean `generate-i18n` the format gate passes and still fails a misformatted `settings.json`; Nx-wide lint passes                         |
| TOOL-03 | Complete | Open the repository to outside contributors under AGPL-3.0, with its intake, CI gate and GitHub settings      | Community files, forms, a title and fork-safe CI gate, the clean-clone `ui:dev` fix and the footer's source-code link on every page shipped in v0.20.0 on 2026-10-03; settings applied 2026-10-02 |

### Remaining work order

Audit-remediation tickets are tracked in the
[Audit Remediation Plan](./audit-remediation-plan.md). AR-02 through AR-07 and AR-09 through AR-13
are complete for the public Worker. AR-08's CSP and secure headers
were enforced in staging and production on 2026-09-04; `apps/admin` remains report-only because its
Access-gated origin still needs an authenticated measurement. The later [deployment evidence](./deployment-evidence.md)
records CSP enforcement, Queue consumers, the EC release and the Round Table redesign. This is
documentary evidence, not a new live CI or infrastructure certification.

The following order supersedes older sequencing notes in this document and its supporting plans.
Each step is a release or verification dependency; completed work is retained as evidence and is
not repeated.

1. **Maintain release foundations:** retain the completed `P0-004`, `P0-008`, `P0-016`, and `P0-019`
   deployment evidence and recheck account-side provider and secret state whenever an environment
   changes.
2. **Close security gaps:** complete the anonymous map protection and remaining mutation permissions
   under `P1-018`; authenticated RSVP and other session-bound mutations use authz plus rate limiting
   without a browser challenge. Replace the removed dependency-advisory gate and record token-rotation
   evidence when the CI replacement is approved.
3. **Promote notification delivery:** ship and verify `P0-018/P1-009/ND-08` so production matches
   staging's push-primary/email-fallback policy, including real provider delivery evidence.
4. **Verify live event coordination:** complete `P1-010` Durable Object expiry, heartbeat cleanup,
   and cancellation behavior.
5. **Build the meetup chat:** deliver `P1-026` CH-02 through CH-09. It shares the live room's
   session, membership and heartbeat code from step 4.
6. **Build operational administration:** deliver `CO-08/CO-09` for event operations, corrections,
   moderation (the meetup chat's report review included), host trust, and audit.
7. **Open the meetup chat:** deliver `P1-026` CH-10, then CH-11, which turns the chat on in
   production. Telegram groups were retired ahead of it, with CH-12, whose migration 0044 is
   promoted before CH-11's.
8. **Deliver community-health evidence:** implement `CO-10/P1-019` metrics repositories, dashboards,
   alerts, retention snapshots, denominators, and as-of evidence.
9. **Run the operational launch rehearsal:** complete `CO-11/P1-021/P1-023` across all checkpoints,
   locales, directions, roles, mobile/desktop surfaces, and recovery paths.
10. **Finish PWA verification:** complete `P1-020` offline behavior, Lighthouse budgets, and PWA
    Builder checks.
11. **Complete profile/account work:** finish `PF-04c`, then `PF-11a/PF-11b` CO integration and
    localized UX, and `PF-12` release evidence. `PF-09` export and `PF-10` deletion are carried out
    on request through the [account requests runbook](./account-requests.md) and the nightly
    erasure (#105); what remains of them is the member-facing request on the account screen, and
    the retention jobs #106 tracks.
12. **Complete search-engine operations:** deliver `SEO-12` Search Console/Bing submission, sitemap
    processing, representative URL indexing, and 30-day monitoring.
13. **Complete notification controls:** `ND-06` provider-aware, responsive per-category controls and
    push-permission UX are implemented; retain `ND-08` production evidence as the release gate from
    step 3.
14. **Close documentation:** `TOOL-01` resolved the Nx-wide i18n source-import graph error and
    Nx-wide lint is green; keep deployment evidence synchronized with the SEO and notification plans.

Future sponsorship, challenges, talent, payments, semantic search, browser-generated OG images, and
new-market expansion remain outside this order behind the community validation gate.

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

**Status: Future.** Payment automation and additional-market operations require the community validation gate, explicit Founder / Product approval, and the relevant compliance review. The current configured markets are DZ, EG, and SA; adding another market requires a separate geography, operations, and compliance decision.

## 9. Continuous gates

- Every change maps to a ticket and SRS requirement.
- Run `nx sync:check`, typecheck, lint, unit/integration tests, and relevant Playwright tests.
- Test Cloudflare bindings through Miniflare; provider-interface fakes are allowed only for external services or bindings Miniflare cannot emulate.
- Audit `ar`, `fr`, `en`, RTL/LTR, accessibility, security, performance, and observability per feature.
- Never promote `Partial` or `Blocked` work to `Complete` without evidence.
