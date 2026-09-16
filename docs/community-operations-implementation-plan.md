# Community Operations and Admin Implementation Plan

| Field          | Value                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | Active; EC-10 signed off, CO-01 through CO-07 implemented locally, CO-02/CO-03 deployed to both environments, P0-004/P1-017 production admin verification complete, and CO-06/CO-07 remain locally verified pending promotion |
| Last reviewed  | 2026-09-16 — session-aware Turnstile policy reconciled                                                                                                                                         |
| Scope          | Post-creation community operations across `apps/ui`, `apps/admin`, `apps/worker-jobs`, and shared libraries                                                                                    |
| Predecessor    | [Event Creation Remediation Plan](./event-creation-remediation-plan.md), EC-01 through EC-10                                                                                                   |
| Parent tickets | P0-004, P0-018, P1-008, P1-009, P1-013, P1-017, P1-018, P1-019, P1-021, P1-023                                                                                                                 |
| Requirements   | FR-E3, FR-E4, FR-E8, FR-E10 through FR-E15, FR-M1 through FR-M4, FR-M6 through FR-M10; NFR-4, NFR-5, NFR-7 through NFR-12                                                                      |
| Strategy       | [Community-first release](./release-strategy.md)                                                                                                                                               |
| Related plans  | [Events System Plan](./events-system-plan.md), [Implementation Plan](./implementation-plan.md)                                                                                                 |

## 1. Objective

Turn the event product into an observable, repeatable community operating loop without turning
`apps/admin` into a speculative CRM or moving host/member work out of `apps/ui`.

```text
recruit and support a host                    human community operation
  -> create and publish a trustworthy event  apps/ui + EC-01..EC-10
  -> RSVP and cancel                         apps/ui + P1-008
  -> remind and deliver                      DO alarms -> Queue -> push-first/email-fallback
  -> hold the meetup                         real-world community operation
  -> close out attendance                    host in apps/ui; admin oversight/correction
  -> collect a small feedback pulse          attended member in apps/ui
  -> invite return and repeat hosting        worker-jobs + apps/ui
  -> inspect health and exceptions           apps/admin
  -> improve the next event                  human community operation
```

Completion means the team can operate the Algiers community using truthful event, attendance,
repeat-participation, and host-retention evidence while members and hosts remain in the warm public
PWA. Internal staff use `apps/admin` only for oversight, trust, moderation, correction, and
community-health decisions.

This plan adds no sponsorship, challenge, talent, payment, expansion, native-mobile, or
nonessential AI work. It introduces no new vendor, Cloudflare service, or package. If execution
proves that the locked stack is insufficient, work pauses for explicit approval under AGENTS.md
§1.8.

Security policy update (2026-09-16): Turnstile is rendered and verified only for public or anonymous
operations. Authenticated member and operator mutations use Better Auth sessions, centralized
permissions, identity-scoped rate limiting, and applicable WAF controls without a browser challenge.

## 2. Sequencing contract with the event-creation plan

The plans are consecutive, not competing:

1. The event-creation plan owns the complete create-event vertical slice through EC-10.
2. No `CO-*` production implementation begins while any EC ticket remains incomplete.
3. As soon as EC-10 is verified, CO-01 becomes the immediate next work package.
4. CO-02 closes the already-documented RSVP and notification blockers before post-event automation
   depends on them.
5. The remaining `CO-*` packages then execute in order unless a package explicitly lists safe
   parallel work.

EC-10 handoff evidence must include the created staging event ID, canonical route, host identity,
market/city, deployment version, migration state, WAF/Turnstile evidence, and successful local and
staging Playwright results. CO-01 records that trace as event-creation baseline evidence only. The
event is not reused as a post-event attendance fixture because its real participants and elapsed
schedule cannot be assumed. CO-11 creates its own explicitly identified operational staging run.

PF-01 reconciliation on 2026-09-08: the EC plan and `deployment-evidence.md` record 18/18 staging
cases, persisted events and cleanup on 2026-09-03, then production release and DNS/WAF verification
on 2026-09-04. The authorized production creation smoke was performed by hand on 2026-09-10 with
no change to production configuration, and EC-10 is signed off; CO-01 is therefore the immediate
next work package. Do not treat the older EC-08–10 pending baseline as current, or infer authorization to
weaken production authentication or create test events from this documentation update. Turnstile
handoff evidence follows the actual login protection; event creation's recorded exception is not
a requirement to add a new event challenge as part of CO or PF.

## 3. Ownership boundaries

The [Profile and Account Management Plan](./profile-account-implementation-plan.md), approved
2026-09-08, owns location-free member onboarding, editable/public profile projection, contact/session
controls and export/deletion orchestration. CO-02 continues to own delivery, CO-03 the operations
schema/retained references, CO-05/06 closeout/feedback and CO-09 trust/moderation. Those integrations
must never depend on a member's home location. PF deletion must preserve frozen eligibility and
the retention rules below; it must not cascade-delete events or introduce a second retention model.
This supporting lane does not change the EC → CO sequencing contract.

| Concern                                      | Owner                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Discover, RSVP, cancel                       | `apps/ui`                                                                                 |
| Create an event                              | `apps/ui`; owned entirely by EC-01 through EC-10                                          |
| Host closeout and repeat-host action         | `apps/ui`                                                                                 |
| Attendee feedback and return action          | `apps/ui`                                                                                 |
| Event operations, exceptions, and correction | `apps/admin`                                                                              |
| Host trust and moderation                    | `apps/admin`                                                                              |
| Community-health metrics                     | `apps/admin`, calculated from shared domain definitions and D1 repositories               |
| Timed prompts and delivery                   | `apps/worker-jobs` through Durable Object alarms and Queues                               |
| Schemas and metric definitions               | `libs/domain`                                                                             |
| Persistence and atomic helpers               | `libs/db`                                                                                 |
| Validated/authenticated boundaries           | `libs/server-fns`                                                                         |
| Shared visual primitives                     | `libs/ui`; no admin-only design-system fork                                               |
| Host recruitment and coaching                | Founder / community operator; software exposes evidence but does not replace the practice |
| Venue relationships and event quality        | Founder / community operator; no venue CRM is authorized in this plan                     |

Components continue to follow:

```text
component -> hook -> feature api.ts -> server function -> domain -> repository -> D1
```

Both UI apps use thin route files and feature-domain folders. `apps/admin` may never import D1,
Drizzle, domain internals, or server functions from a component.

## 4. Current baseline and gaps (reviewed 2026-09-14)

| Area                      | Current evidence                                                                                                                                                                    | Required result                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Event creation            | EC-01 through EC-10 signed off; staging 18/18, production release/DNS/WAF evidence, and the authorized production smoke are recorded                                                | Preserve the dated handoff trace; no additional creation smoke is required for CO work                  |
| RSVP                      | Immediate flow exists; full-capacity atomicity and duplicate handling are fixed by AR-04/CO-02. RSVP is session-bound and uses authz plus rate limiting without a browser challenge | Race-safe, idempotent RSVP/cancellation before attendance relies on the going list                      |
| Notifications             | Historical one-minute D1 polling and parallel channel scheduling were replaced by CO-02; staging push/email delivery is proven and production policy parity remains open            | DO alarms -> Queue -> push-first/email-fallback before post-event prompts (ND-07)                       |
| Event lifecycle           | `published` and `cancelled` only; an elapsed end time does not prove the meetup happened                                                                                            | Explicit held/did-not-happen closeout separate from publication status                                  |
| Attendance                | RSVP intent and denormalized going count exist; actual attendance/no-show evidence does not                                                                                         | Attendance outcome remains separate from RSVP intent and is recorded safely                             |
| Feedback                  | No post-event participant or host pulse                                                                                                                                             | One small, optional, localized pulse per eligible person                                                |
| Repeat hosting            | Hosts must recreate every event from scratch                                                                                                                                        | Safe “host another like this” path that reuses allowed values and revalidates through the EC contract   |
| Admin app                 | Access JWT guard and the CO-04 operations shell are implemented; Access/Better Auth correlation and the operator role are verified in staging and production under P0-004/P1-017 | Access + Better Auth/RBAC, i18n, Query wiring, operations features, loading/error/empty states          |
| Moderation and host trust | RBAC role names and Better Auth ban fields exist; no operational workflow or audit repository                                                                                       | Central permissions, trust state, event/user actions, reason codes, and immutable audit evidence        |
| Metrics                   | Analytics Engine binding and the first `events_created` write are verified; the account-side dashboard and remaining community metrics are not complete                             | Stable metric definitions, D1 truth queries, Analytics event telemetry, and denominator-aware dashboard |
| Human operating practice  | Product strategy defines the gate; no executable weekly community cadence is recorded                                                                                               | Named weekly cadence for hosts, calendar coverage, event follow-up, exceptions, and learning            |

## 5. Locked product and data decisions

1. **Elapsed is not completed.** An event counts as completed only when a host or authorized admin
   records the outcome `held`. Passing `endsAt` alone never satisfies the density gate.
2. **Publication status and operational outcome stay separate.** Existing event status continues to
   control public visibility/cancellation. A one-to-one closeout record stores `held` or
   `did_not_happen` after the event.
3. **RSVP is intent; attendance is outcome.** Do not overload RSVP status with attendance. Store one
   outcome per event/member so cancellation and waitlist semantics remain intact.
4. **Registered attendance is identity-scoped.** A host may mark only members who had a valid
   `going` RSVP for that event. Anonymous walk-ins are recorded only as an aggregate count; no
   speculative identity or profile is created.
5. **Closeout counts are derived.** Registered attendee count comes from valid attendance records;
   total attendance equals registered attended members plus non-negative aggregate walk-ins. The
   client cannot submit an inconsistent total.
6. **D1 writes are race-safe.** Closeout, attendance, corrections, and feedback use conditional SQL,
   `ON CONFLICT`, and `db.batch()` helpers. No interactive read-decide-write transaction is allowed.
7. **Feedback remains small and private by default.** An attended member may submit one updateable
   pulse: value rating, whether they would return, and an optional bounded comment. Public event
   pages never expose individual feedback. Analytics receives aggregates only.
8. **Host pulse is structured.** Closeout asks whether the host intends to host again and which
   predefined friction categories applied. It does not collect an unrestricted operational diary.
9. **Host closeout belongs in `apps/ui`.** Hosts must never enter the internal admin app to finish an
   ordinary event. Admin can inspect, correct, or complete an overdue closeout with a required reason.
10. **Repeat hosting reuses, then revalidates.** “Host another like this” may prefill the source
    city, venue, title, and description—the safe fields exposed by the current EC wizard. Event
    language follows the active locale because EC has no separate language control. The flow never
    copies timestamps, attendance, IDs, slug, closeout, security responses, or expired provider
    state. Submission still uses the EC shared schema and the existing EC authorization,
    rate-limit, and WAF pipeline; the event-create Turnstile challenge remains intentionally
    disabled by the recorded product decision.
11. **The admin app is double-gated.** Cloudflare Access JWT verification remains mandatory and
    `workers.dev` stays disabled. Inside the Worker, Better Auth session and centralized RBAC permit
    only `moderator`/`admin` operations. Access identity alone never grants product permissions.
12. **Admin permissions are explicit.** Add centralized actions for operations read, metrics read,
    event moderation, closeout override, host-trust update, user moderation, and audit read. No
    component or server function performs an ad hoc role comparison.
13. **State changes retain the security baseline.** Host closeout, feedback, repeat-event creation,
    moderation, trust updates, and corrections use Zod, authz, identity-scoped DO rate limiting,
    and applicable WAF policies. These are session-bound operations and do not render or require a
    browser Turnstile challenge; anonymous/public operations retain their own challenge policy.
14. **Analytics contains no PII or free text.** D1 remains the source of truth. Analytics Engine
    receives event names, market/city, locale, and aggregate numeric values—never names, emails,
    phone numbers, comments, venue free text, or raw identifiers.
15. **All operational UI is localized and accessible.** `ar`, `fr`, and `en` are complete; Arabic
    RTL and French/English LTR meet WCAG 2.1 AA. Internal status codes stay stable and untranslated.
16. **No speculative CRM.** Host recruiting, personal outreach, café negotiation, and event coaching
    remain human practices. Admin features are added only for safety, trustworthy measurement, or a
    recurring operational burden demonstrated during the Algiers launch.
17. **RSVP eligibility freezes at event start.** Creating, cancelling, or restoring an RSVP is
    allowed only while trusted server time is strictly before `startsAt`. At and after `startsAt`,
    RSVP intent is immutable, so later cancellation cannot erase attendance eligibility.
18. **Admin identities are correlated, not merely stacked.** Every admin uses an admin-owned Better
    Auth account behind Access. The verified Access email must equal the verified Better Auth email;
    middleware carries the Access subject and Better Auth user ID in one trusted context, and audit
    records both identities. A valid token and unrelated product session must fail closed.
19. **Operations data is market-scoped at rest.** Closeouts, attendance, feedback, host trust, audit,
    and weekly reviews carry `market_code`; geographic event-derived records also carry
    `state_code`/`city_code`. Host trust is unique per `(market_code, user_id)`, never global by
    accident.
20. **Feedback has one concrete window.** A held closeout submitted no later than seven days after
    `endsAt` creates invitations for attended members. An eligible member may create or update the
    pulse until fourteen days after `endsAt`; late closeouts do not reopen the window.
21. **Retention is explicit.** Closeout, attendance, structured feedback, weekly reviews, and audit
    are retained for 24 months; feedback comments for 12 months; current host trust for the account
    lifetime and 24 months after closure or its last transition; non-PII monthly aggregates
    indefinitely. Account deletion/export follows NFR-5 and removes or anonymizes member-linked data
    while retaining lawful aggregate evidence.
22. **Operational enums are locked.** Host friction is one or more of `venue`, `scheduling`,
    `promotion`, `attendance`, `format`, `safety`, or `other_structured`. Correction/moderation reasons
    are `host_request`, `member_dispute`, `data_entry_error`, `safety`, `policy`, or
    `delivery_recovery`; `other_structured` requires a bounded private note in D1, never Analytics.
    Weekly bottleneck is `host_supply`, `calendar_consistency`, `venue_readiness`, `discovery`,
    `rsvp_conversion`, `attendance`, `event_quality`, `return_behavior`, or `product_reliability`.
23. **Feedback comments preserve language.** A non-empty optional comment requires its authored
    language code (`ar`, `fr`, or `en`) and is rendered as authored without automatic translation.
24. **Legacy missing end times fail visibly.** Existing events with `endsAt = null` are excluded from
    closeout, attendance, feedback, and completed-event metrics and appear in an admin attention
    state. Any correction is an explicit audited backfill; no duration is inferred.
25. **Weekly decisions are first-party records.** Each weekly review writes one D1
    `operations_reviews` record containing scope, evidence window, bottleneck, intervention, owner,
    due date, and follow-up result. This is the operating record; no CRM is introduced.
26. **Market-scoped rollout is reversible.** `communityOperations` gates closeout, feedback,
    repeat-host, operations, and metrics entry points and server functions. It is enabled for every
    configured market by the 2026-09-14 Founder decision. Disabling it never deletes data or reopens
    frozen RSVP intent; security-critical moderation and host-trust controls remain available.

## 6. Canonical community-health definitions

Every calculation is implemented once as a pure domain definition and queried through repository
functions. Dashboards always show the numerator, denominator, time window, timezone, and as-of time.

| Metric                   | Canonical definition                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completed event          | Event has a closeout outcome of `held`; grouped into the calendar month containing `endsAt` in the event market timezone                            |
| Did-not-happen event     | Event has closeout outcome `did_not_happen`; excluded from completed-event density and included in reliability reporting                            |
| Registered attendance    | Count of valid going RSVPs with attendance outcome `attended`                                                                                       |
| Walk-in attendance       | Non-negative aggregate recorded in the closeout; never used for person-level repeat metrics                                                         |
| RSVP-to-attendance rate  | Registered attended / (`attended` + `no_show`) for closeouts with at least one recorded RSVP outcome                                                |
| No-show rate             | `no_show` / (`attended` + `no_show`) for the same eligible set                                                                                      |
| Recurring host           | Host with at least two completed events in the trailing 90 days                                                                                     |
| 60-day host retention    | Among hosts whose first completed event is at least 60 days old, share with another completed event within 60 days of the first                     |
| Repeat participation     | Share of identified attendees in the trailing 90 days who attended at least two completed events; walk-ins excluded from numerator and denominator  |
| Return intent            | Share of submitted attendee pulses with `wouldReturn = true`; display response count and response rate                                              |
| Host-again intent        | Share of completed-event host pulses with `wouldHostAgain = true`; display response count                                                           |
| Four-week schedule cover | Count of published, non-cancelled events ending in the next 28 days, compared with the operating target of roughly eight completed events per month |
| Overdue closeout         | Event ended more than 24 hours ago, is not cancelled, and has no closeout                                                                           |

The release-strategy gate remains authoritative: at least eight completed events per month for
three consecutive months, at least three recurring hosts, host retention of at least 60%, healthy
repeat participation, a stable release, and explicit Founder / Product approval. The dashboard
reports evidence; it never opens a future phase automatically.

## 7. Persistence model

All schema changes live in `libs/db` and require forward-only reviewed migrations.

```text
event_closeouts
  event_id                    PK/FK -> events.id
  market_code                 FK -> markets.code
  state_code                  event-derived geography code
  city_code                   event-derived geography code
  outcome                     held | did_not_happen
  walk_in_count               integer >= 0
  would_host_again            boolean | null
  host_friction               bounded JSON array of shared enum values
  submitted_by_user_id        FK -> user.id
  submitted_at                UTC timestamp
  updated_by_user_id          FK -> user.id
  updated_at                  UTC timestamp
  version                     integer for conditional correction

event_attendance
  id                          core id factory
  event_id                    FK -> events.id
  user_id                     FK -> user.id
  market_code                 FK -> markets.code
  state_code                  event-derived geography code
  city_code                   event-derived geography code
  outcome                     attended | no_show
  recorded_by_user_id         FK -> user.id
  recorded_at                 UTC timestamp
  updated_at                  UTC timestamp
  UNIQUE(event_id, user_id)

event_feedback
  id                          core id factory
  event_id                    FK -> events.id
  user_id                     FK -> user.id
  market_code                 FK -> markets.code
  state_code                  event-derived geography code
  city_code                   event-derived geography code
  value_rating                valuable | okay | not_valuable
  would_return                boolean
  comment                     nullable, trimmed, bounded
  comment_language            ar | fr | en, required when comment is non-empty
  created_at                  UTC timestamp
  updated_at                  UTC timestamp
  UNIQUE(event_id, user_id)

host_trust
  id                          core id factory
  market_code                 FK -> markets.code
  user_id                     FK -> user.id
  status                      unreviewed | verified | restricted
  reason_code                 shared enum | null
  reviewed_by_user_id         FK -> user.id | null
  reviewed_at                 UTC timestamp | null
  updated_at                  UTC timestamp
  UNIQUE(market_code, user_id)

operations_audit
  id                          core id factory
  market_code                 FK -> markets.code
  actor_user_id               FK -> user.id
  access_subject              verified Access JWT subject | null; required for admin actions
  action                      stable shared enum
  target_type                 event | user | closeout | attendance | feedback | host_trust | operations_review
  target_id                   string
  reason_code                 stable shared enum | null; required for corrections/moderation
  metadata                    bounded non-PII JSON including stable before/after values when changed
  created_at                  UTC timestamp

operations_reviews
  id                          core id factory
  market_code                 FK -> markets.code
  state_code                  nullable geography code
  city_code                   nullable geography code
  evidence_window_start       UTC timestamp
  evidence_window_end         UTC timestamp
  bottleneck                  shared structured enum
  intervention                bounded operational text with no member PII
  owner_user_id               FK -> user.id
  due_at                      UTC timestamp
  follow_up_result            nullable bounded operational text with no member PII
  created_by_user_id          FK -> user.id
  created_at                  UTC timestamp
  updated_at                  UTC timestamp

community_metric_snapshots
  id                          core id factory
  market_code                 FK -> markets.code
  scope_type                  market | state | city
  scope_code                  non-null canonical market/state/state:city key
  period_month                market-local YYYY-MM
  metric_key                  shared metric enum
  numerator                   non-negative integer
  denominator                 nullable non-negative integer
  computed_at                 UTC timestamp
  UNIQUE(market_code, scope_type, scope_code, period_month, metric_key)
```

Indexes must cover overdue closeouts by event end/status, attendance by user/event, feedback by
event, host completed-event cohorts, trust status, audit by market/time/target, weekly reviews by
market/window, and metric snapshots by market/scope/month/key. Repository tests must inspect D1
query plans for the dashboard hot paths before the plan is marked complete.

Every attendance insert or correction writes an append-only `operations_audit` entry in the same
atomic batch with stable before/after outcome values. The mutable current row serves reads; the audit
stream reconstructs who changed each person-level outcome, when, and why, including the correlated
verified Access identity whenever an admin performed the change.

## 8. Work breakdown and sequence

The `CO-*` identifiers are local work packages under the listed P0/P1 tickets. Each package is one
mission and should remain one reviewable PR unless its security/data migration must be split.

### CO-01 — Establish the operating contract and baseline

**Parent:** P1-019, P1-023
**Requirements:** FR-E10, FR-M1, FR-M7 through FR-M10; NFR-5, NFR-7, NFR-10
**Status:** Complete — approved 2026-09-10. The operating contract is recorded at the end of this
document; §5, §6 and §7 are frozen from that date. CO-02 followed and is implemented/deployed; see
its own status below.

Work:

- Freeze the §5 decisions, §6 metric formulas, worked test vectors, and §7 persistence contract as
  documentation. Production schemas and code remain owned by CO-03.
- Capture the EC-10 staging event as event-creation baseline evidence only, without fabricating or
  attaching attendance, feedback, or post-event outcomes.
- Establish a weekly Founder / community-operator cadence covering the next four weeks of events,
  host availability, venue readiness, overdue closeouts, attendance/no-shows, repeat participants,
  host friction, moderation, and the next concrete intervention.
- Define who may act as `moderator` and `admin`, how access is granted/revoked, and how emergency
  event/user action is reviewed.
- Approve the concrete retention and deletion/export contract in §5 before production data is
  collected.
- Define three dedicated disposable staging identities: host, member, and admin. Explicitly seed and
  revoke roles; require the admin's Access email to equal its verified Better Auth email; never give
  staging privileges to a production community account.
- Take a dated baseline of current admin, D1, Analytics, Queue, Access, and secrets configuration.

Verification:

- Every dashboard metric has an unambiguous formula, time window, and test example.
- The staging account matrix names each identity, required role, Access policy, environment, owner,
  expiry/revocation step, and permitted test data.
- The operating cadence has an owner and an approved D1 review-record template; the first persisted
  review is an acceptance outcome of CO-08/CO-11, after its schema and UI exist.
- No future commercial metric or feature enters the baseline.

### CO-02 — Close inherited RSVP and notification blockers

**Parent:** P1-008, P1-009, P0-018, P1-018
**Requirements:** FR-E3, FR-E4, FR-E8, FR-E10; NFR-4, NFR-7, NFR-11
**Status:** Complete and deployed to staging and production on 2026-09-10. What changed, and what it costs:

- **RSVP freeze.** `libs/db/src/rsvps.ts` gates create, cancel and restore on
  `starts_at > unixepoch()` inside the conditional write itself, so server time decides and no
  read-then-write window exists. At or after the start instant the operation returns `rsvp_closed`
  and the going set is frozen for attendance eligibility.
- **Alarms replace the poll.** `NotificationScheduleDO` (one object per event, in
  `apps/worker-jobs`) holds an alarm at that event's next `send_at`, fires a `notification_due`
  message onto the notifications queue, and rearms from the table. The cron drops from `*/1` to
  `*/15` and is now a recovery sweep for the rows no alarm announces. `apps/ui` reaches the object
  through a cross-script binding, so **worker-jobs must be deployed before ui**.
- **Push first, SMS only behind it, no email in the event lane.** One row per notification on
  `push` with `fallback_channel = 'sms'`; the duplicate SMS/email-plus-push pair is gone. Email
  survives only as the cancellation fallback for a member with no consented number — a missed
  reminder costs a calendar entry, an unheard cancellation sends someone to a café for nothing.
- **Superseded 2026-09-10 by ND-07 — push first, _email_ behind it, SMS for same-day disruption
  only.** The rule above is kept as the record of what CO-02 built; it is no longer the policy, and
  every unimplemented CO ticket below reads under this amendment. See
  [notification delivery](./notification-delivery-implementation-plan.md) §ND-07 for the evidence.
  In short: authentication here is an email OTP, so a member without a working verified address
  cannot exist, which makes email the one channel that reaches everyone at no cost per message. Push
  does not — iOS needs the app installed, a denied permission is permanent, and a subscription dies
  quietly when a device signs out — so something has to sit under it. SMS was billing per message to
  reach people the free channel already reaches. It now survives only where an unread email means
  somebody sets off anyway: a cancellation inside `isSameDay` of the start.
  **Two facts found while proving this, both of which this plan asserted otherwise:** push had never
  delivered a notification in any environment, because no `FIREBASE_*` secret existed and the service
  worker was never built; and email had never delivered one either, because the dispatcher set its own
  `Message-ID`, which Cloudflare rejects. Both are fixed and both are now proven on staging.
- **Preferences are enforced at send time**, in `resolveDestination`, against the values current
  when the row is sent rather than when it was written. Categories (`event_reminders`,
  `event_updates`) are account-level refusals and write no fallback; channels (`push_enabled`,
  `sms_fallback_enabled`) are not, so the other channel is still tried. `rsvp_confirmation` passes
  every category gate, being a receipt rather than an update.
- **The consequence, as it actually resolved:** this section predicted the SMS path would stay dark
  until PF-08 shipped a consent control. PF-08 shipped it, ND-00 deleted it again, and ND-07 then
  removed the reason to want it — email needs no consent and reaches everyone. `sms_fallback_enabled`
  still defaults disabled and still has no surface, which now costs nothing outside the same-day
  cancellation path. `push_enabled` is recorded by device registration, and push is reachable and
  proven as of 2026-09-10.
- **Account-side evidence:** all eight queues exist in both environments; the notifications queues
  have their producer and consumer bindings, and both DLQs have zero consumers by design. The
  `NotificationScheduleDO` namespace is deployed in both environments. Version IDs and run links
  are recorded in [deployment evidence](./deployment-evidence.md#current-operational-snapshot--2026-09-14).

Work:

- Complete the existing atomic RSVP/cancellation remediation in the Events System Plan so a full
  event cannot insert an RSVP, duplicate actions are idempotent, and counters cannot drift.
- Enforce the §5 RSVP freeze with trusted server time and conditional D1 writes: create, cancel, and
  restore operations succeed only when `now < startsAt`; at or after `startsAt` they return a stable
  typed error and preserve the frozen going set used for attendance eligibility.
- Replace one-minute D1 reminder polling with per-event Durable Object alarms feeding the
  Notifications Queue and a low-frequency recovery sweep.
- Enforce the active ND-07 policy: PWA push first, email fallback, and SMS only for same-day
  cancellation disruption; remove parallel default SMS/email event reminders.
- Verify notification preferences, idempotency, retry, DLQ, delivery observability, and the
  production/staging bindings already required by P1-009/P0-018.
- Retain email for authentication, the default event fallback, and explicitly email-selected
  workflows.

Verification:

- Miniflare integration tests use real D1, Durable Objects, and Queues.
- Full/duplicate/concurrent RSVP and cancellation cases cannot corrupt capacity.
- Boundary tests prove mutations just before start behave correctly and every mutation at or after
  the exact start instant is rejected, including concurrent cancel/closeout races.
- Delivery tests prove push success suppresses the fallback, permanent/unavailable push selects it
  (SMS as CO-02 built it, email since ND-07), and
  retries never double-deliver.
- Account-side Queue/DLQ and WAF evidence is recorded for staging and production.

### CO-03 — Implement the community-operations domain and D1 model

**Parent:** P1-013, P1-019, P1-023
**Requirements:** FR-E11 through FR-E13, FR-M4, FR-M7 through FR-M10; NFR-4, NFR-5, NFR-7, NFR-10, NFR-11
**Status:** Complete and deployed to staging and production on 2026-09-10. What exists and what it costs:

- **The seven §7 tables** and their indexes, in `libs/db/src/schema.ts`, with migration `0025`.
- **Every write is conditional and audited in the same batch.** A closeout, an attendance outcome
  and a trust decision each pair with an `operations_audit` insert selected from the same table
  under the same predicate, so a refused write produces no audit row and an audited change that did
  not happen is unreachable. Corrections are guarded on `version`; the audit statement is ordered
  _before_ the update, because D1 applies a batch in order and one placed after would test a
  version the update had already bumped.
- **Geography is copied from the event, never accepted from the caller** (§5.19). A market code
  supplied next to an event id is one typo from filing a Chlef meetup under Algiers.
- **The §6 definitions are pure functions with golden vectors** in `libs/domain/src/operations`. A
  zero denominator reports `null` rather than `0`: "nobody was asked" and "everybody said no" are
  opposite facts and a dashboard rendering both as 0% invites the wrong intervention.
- **The feedback window is anchored to `ends_at`, never to the closeout**, which is the only way
  §5.20's "late closeouts do not reopen the window" is actually true.
- **`communityOperations` is enabled for every configured market in the launch release** (migration
  `0027`); an absent or non-boolean value still resolves to disabled. It gates closeout, feedback,
  repeat-host, operations and metrics; moderation and host trust stay available.
- **Legacy `ends_at IS NULL` events are excluded from every path and listed for attention** (§5.24).
  No duration is inferred anywhere.
- **Retention runs in bounded market-scoped batches**: comments cleared at twelve months with the
  structured pulse kept, rows retired at twenty-four, aggregates never. Member withdrawal removes
  the person and keeps the meetup.
- **Deployment evidence:** migration `0025` and its predecessors `0021`–`0024` were promoted in
  journal order and applied to both environments. `libs/db/pending-migrations/` contains only its
  README, and the quarantine guard passes. The applied versions and workflow links are recorded in
  [deployment evidence](./deployment-evidence.md#current-operational-snapshot--2026-09-14).

Work:

- Add Zod schemas and inferred commands for closeout, attendance outcomes, feedback, host trust,
  operational actions, the locked friction/reason enums, authored comment language, weekly reviews,
  and metric windows in `libs/domain`.
- Add the tables and indexes in §7 to the Drizzle schema and generate a forward-only migration.
- Build conditional insert/update and batch helpers that enforce event ownership, eligible RSVP,
  closeout timing, the concrete feedback window, one feedback per attended member, optimistic
  correction version, and append-only per-attendance audit writes.
- Implement pure metric definitions and golden test vectors. CO-10 owns the aggregate dashboard
  repository queries; CO-03 provides only row-level repositories and atomic helpers required by
  closeout, feedback, trust, and weekly review workflows.
- Add the typed `communityOperations` feature flag and shared read helper to the existing first-party
  flag configuration, seed it enabled for every configured market (migration `0027`), and prove
  absent/invalid values resolve to disabled. CO-05 through CO-08 and CO-10 own enforcement on the
  real routes/server functions they introduce; moderation and host trust remain ungated.
- Detect legacy `endsAt = null` rows during migration verification, add the repository attention
  query and typed state used later by CO-08, and provide only an authorized audited backfill command;
  never infer an end time.
- Add idempotent retention/anonymization helpers for each §5 period and monthly aggregate snapshot
  writes. They must operate in bounded, market-scoped batches and preserve required audit evidence.
- Define stable typed errors for not ended, not host, ineligible attendee, already closed, stale
  correction, invalid outcome, and feedback-ineligible cases.

Verification:

- Domain tests cover all schemas, transitions, enums, metric formulas, time windows, retention
  classification, and zero-denominator behavior.
- Fresh and upgrade Miniflare D1 migrations pass with existing event/RSVP data preserved.
- Concurrent duplicate closeout/feedback/correction attempts remain idempotent or return a stable
  typed conflict without partial attendance/audit writes.
- Repository integration tests prove market scoping, eligibility, authorization inputs, query-plan
  index use, and no interactive D1 transactions.

### CO-04 — Make `apps/admin` a secure operational application — verified on staging 2026-09-11

Every bullet but one is done and proven in a browser; evidence in
[deployment evidence](./deployment-evidence.md). The exception is DO/WAF rate limiting on sign-in,
recorded below rather than built.

**Slice 1 landed 2026-09-11 — the identity spine.** Two Cloudflare Access applications now sit over
`admin-staging` and `admin.founders.coffee`; both hostnames answer 302 to the Access login where they
previously answered the Worker's own 403, which proved requests had been reaching the Worker
unprotected. `CF_ACCESS_TEAM_DOMAIN` and the per-application `CF_ACCESS_AUD` are set in both
environments, each verified against the AUD Cloudflare binds to that hostname rather than assumed
from the variable name.

In code: `verifyAccessJwt` returns the verified identity instead of pass-or-null;
`resolveAdminContext` requires an Access identity **and** a Better Auth session **and** the two to
name the same person **and** an `admin`/`moderator` role, refusing at each step with a distinct
reason; the worker entry resolves it before the app sees any request, so a route added later is
protected by existing rather than by remembering. The admin app gained the D1 binding it had never
had — without it there was nothing to correlate against, and the app was safe and useless. Ten tests
cover every refusal and the admissions.

**Slice 2 landed 2026-09-11 — sign-in on the admin origin.** The shared `createAuthHandler` is
mounted at `/api/auth/*` on admin with its own echo-free OTP mailer and a `send_email` binding the
app did not have; `APP_URL` is the admin host, so Better Auth issues a host-scoped cookie without
being asked and no cross-subdomain widening is needed. `needsAdminSession` exempts `/login` and
`/api/auth/*` from the session requirement by allowlist — a route added later is guarded by default
— while Access still gates both.

Audit of that slice found the sign-in endpoint would mail a code to any address a caller named.
`authRequestIsForSelf` pins it to the Access-verified identity, which removes the vector rather than
rate-limiting it and makes the correlation true one request earlier.

**Slice 3 landed 2026-09-11 — the permission table.** §5.12's seven actions exist as central
statements: `operations:read`, `metrics:read`, `moderation:event`, `moderation:user`,
`closeout:override`, `host_trust:update`, `audit:read`. A moderator holds all but the closeout
override, which is admin-only — that action rewrites the record of whether a gathering happened, and
every other number is derived from it. `roleAllows` and `requirePermission` are the only way to ask,
and `resolveAdminContext`'s own `ADMIN_ROLES.includes(role)` — an ad hoc comparison of exactly the
kind §5.12 forbids — is gone.

Audit of that slice found two things. `roleAllows` tested membership with `in`, which walks the
prototype chain, so the string `constructor` reached a value that is not a role; it uses
`Object.hasOwn` now. And `requireRole`, exported and called by nothing, is an exact match that would
have refused an admin a moderator's action the first time CO-08 reached for it; `requirePermission`
now sits beside it and the doc comment says which to use.

**Slice 4 landed 2026-09-11 — the application.** The placeholder is gone. `/` is an authenticated
operator-status screen: the account, the role, and the permissions **derived from the same
`roleAllows` the server asks when an action is attempted**, so the screen cannot drift from what the
product permits. Sign-out, a not-found boundary, Query, and a locale toggle sit around it. Copy is in
`ar`, `fr` and `en`, the document carries `lang`/`dir`, and the Turnstile widget moved to `libs/ui`
so the admin login uses the same widget the public one does rather than a second copy.

Audit of that slice found two blockers and one fixed defect:

1. **Sign-in cannot work on staging as configured.** `createAuthHandler` answers `503
captcha_unconfigured` on `send-verification-otp` when `TURNSTILE_SECRET_KEY` is absent and
   `TURNSTILE_DISABLED` is not `true`. Admin has neither. Turnstile is not an enhancement here; it is
   the thing that makes the login respond at all.
2. **`TURNSTILE_SITE_KEY` is equally required** — without it the page renders no widget, sends no
   token, and the server refuses anyway.
3. **Fixed: the admin app would have rendered Arabic RTL for everyone, permanently.** `detectLocale`
   reads the Paraglide cookie and falls back to `ar`, cookies are host-scoped, and nothing on the
   admin origin could ever set one. A locale toggle now can.

**Still open in this ticket:** DO/WAF rate limiting on sign-in. The `RATE_LIMITER` Durable Object
lives in the `ui` script and reaching it needs a per-environment cross-script binding. Its marginal
value is now small — a caller is behind the Access policy, can only request a code for their own
address, and must pass Turnstile — so it is recorded rather than built, and CO-08/09 should add it
with the mutations that genuinely need it. The correlated context is consumed by an audit log line and
nothing else; CO-08 and CO-09 will need it threaded to their server functions, which is the point to
add a request-scoped carrier rather than now, unused.

**Known and accepted:** any member Access lets in can create a session on the admin origin, because
the auth handler does not check roles. Every path that matters refuses them — `resolveAdminContext`
requires `admin` or `moderator` — so they hold a session that opens nothing.

#### Original ticket

##### CO-04 — Make `apps/admin` a secure operational application

**Parent:** P0-004, P1-013, P1-017, P1-018, P1-023
**Requirements:** FR-A4, FR-A5, FR-M1 through FR-M4, FR-M6, FR-M9; NFR-4, NFR-8 through NFR-12

Work:

- Preserve Cloudflare Access JWT verification and `workers_dev: false` in every deployed
  environment.
- Change the Access guard to return verified claims, then resolve an admin-owned Better Auth session
  behind Access. On every request, require the verified Access email to equal the verified Better
  Auth email and place the Access subject plus Better Auth user ID into a trusted admin context.
- Keep admin authentication on the admin origin and shared D1/auth configuration; do not depend on a
  cross-domain public-app login redirect. Use secure host-scoped session cookies and the existing
  shared Better Auth implementation.
- Build the real admin-origin passwordless login/logout flow and auth callback endpoints from shared
  Better Auth/i18n/UI modules behind Access; successful login returns to a validated admin-local path.
- Wire Better Auth session resolution, D1, request context, centralized observability, Query,
  locale resolution, secure headers/CSP, and error/not-found boundaries using the shared app wiring.
- Extend centralized RBAC with the explicit operations permissions in §5 and require them on every
  admin server function.
- Build one real authenticated session/status feature plus the minimal shell/navigation and shared
  loading/error/empty states using `libs/ui` tokens. Create `operations`, `moderation`, `hosts`, and
  `metrics` feature folders only in the CO package that supplies their real end-to-end behavior;
  empty files and future-facing placeholders are forbidden.
- Localize all copy in `ar`, `fr`, and `en`; support Arabic RTL and French/English LTR with keyboard
  and focus behavior at WCAG 2.1 AA.
- Apply managed Turnstile plus DO/WAF protection to the public admin sign-in flow. CO-08 and CO-09
  protect authenticated operations/moderation mutations with session authorization, DO limiting,
  and applicable WAF controls without rendering a browser challenge.

Verification:

- Requests fail closed independently for missing/invalid Access JWT, missing session, wrong role,
  mismatched Access/Better Auth identity, missing permission, public sign-in Turnstile failure,
  rate limit, and cross-market input.
- A valid Access identity without a Better Auth `moderator`/`admin` session cannot read operational
  data.
- Tests prove a valid Access identity paired with a different valid Better Auth account is rejected,
  and audit context contains both correlated identity keys.
- Admin component tests cover navigation, all data states, permission errors, RTL/LTR, keyboard
  operation, and responsive layouts.
- The admin app gains real typecheck, lint, test, and build coverage; no production placeholder page
  remains.

### CO-05 — Add host closeout and attendance in `apps/ui`

**Status:** Complete in code and verified on staging on 2026-09-11; production promotion remains a
release action. The six slices and the full-ticket audit below are the implementation record.

**Slice 1 landed 2026-09-11 — the server layer.** `libs/server-fns/src/operations/` is the first
thing above CO-03's database code to import it. `readCloseout` builds the host's roster from the
going RSVPs — the same set the write guard accepts, so a host is never offered a name the database
will refuse — and derives `registeredAttended` and `totalAttended` rather than accepting either.
`submitCloseoutResolver` writes the closeout and then the marks, reporting a refused mark instead of
losing the closeout over it, and records nobody at all when the outcome is `did_not_happen`. Both are
gated on `communityOperationsEnabled`, CO-03's reader, on the read **and** the write. Twelve tests
against real D1.

**Slice 2 landed 2026-09-11 — the host's surface.** `/closeout/$eventId`, private and `noindex`, in
`ar`/`fr`/`en`. The roster appears only once the host says the gathering happened; the two derived
totals are shown **before** submission, because a host who cannot see the number they are producing
cannot notice it is wrong, and the first sight of it should not be a report weeks later. An unmarked
person counts as nobody — a blank is a host who has not said yet, not an assertion that somebody was
absent. Switching to "it did not happen" keeps the marks in the form and strips them at the edge, so
changing your mind twice does not lose the roster. Every server refusal has its own localized
message. Twenty-seven unit tests and thirteen component tests.

Audit of that slice found two things. The page existed and **nothing linked to it** — a host would
have had to know the URL — so `/activity` now offers "close it out" on hosted gatherings that have
ended and were not cancelled. And the walk-in count had no client-side bound, so a host could type a
number the server would refuse with a generic error; `WALK_IN_MAX` is now imported from the domain
rather than retyped.

**Slice 3 landed 2026-09-11 — the prompt, its alarm, and its recovery.** Chosen from three designs
judged adversarially; the cheapest one won and the judges then broke it in five places, all fixed
before a line was written. No new table, no new cron, no migration: one `closeout_prompt` template
key and one row in `scheduled_notifications` whose id is derived from the event, so the creation hook
and the nightly backfill write the same row rather than racing. It sends at `endsAt + 30 minutes`,
push first with email behind it, linking to `/closeout/$eventId` rather than the public event page.

The market flag is enforced at **send** time in `resolveDestination`, not at enqueue. Enqueue-time
gating would mean a market that switches operations on has no intents for anything created while it
was off — the opposite of "recoverable while disabled" — and `resolveDestination` is the one place
every channel already passes and is already wrapped against exceptions, unlike the sweep's
claimed-row loop.

The creation hook cannot touch the event: it swallows everything, and the nightly backfill re-derives
whatever it lost, so a failure is a delay rather than an absence. Failure injection proves it at the
`Db` seam — an insert that throws still leaves exactly one event and no half-written prompt.

Audit of that slice found three things. The hook had to move from `createEventResolver` to
`createEventWithTelemetry`: `markets/index.ts` value-exports a resolver that imports `listEvents`
from `events/resolver.ts`, so that file is on the **browser's** import graph and one edge to
`cloudflare:workers` broke the client bundle outright. The prompt was gated on `host_updates`, a
switch that reads "who is coming to what you host" — asking a host what happened is not that, so it
now passes the category gates like `rsvp_confirmation` does and the market flag is its only gate. And
the date reached the template as a raw ISO string; it is formatted in the market's timezone now, so a
later `{date}` in the copy cannot render `2099-01-15T19:00:00.000Z` in Arabic.

**Slice 4 landed 2026-09-11 — the gathering that did not happen, and the override.** A called-off
gathering notifies every member of the frozen going set once, with an id derived from the (event,
member) pair, carrying no link at all: every destination would imply there is something to do, and
the copy must neither invite feedback nor read as a completion. `correctCloseoutResolver` is the one
path that bypasses "only the host may submit"; its permission is not checked inside it but enforced
by keeping it out of the public barrel, so no member-facing server function can reach it.

**Full-ticket audit, 2026-09-11.** Four auditors read every clause against the code and each claimed
gap went to an independent agent told to refute it. Five claims were refuted — server-side derivation,
the friction/free-text rule, the mutation flag gate, the host-only submission rule, and the
failure-injection coverage all hold. Ten gaps survived, all `should-fix`, none a blocker. Two were
fixed immediately:

- **`event_did_not_happen` never pushed to anybody.** Its payload carried `pushUrl: ''` to mean "no
  link", the schema validates that field with `z.url()`, and the sweep parses every payload before
  dispatching — so each row failed as `invalid_payload`, logged an error per recipient, and reached
  people only through the email fallback a guaranteed push failure happened to create. The field is
  **omitted** now, not emptied: absent is a state the schema has, empty is not.
- **A closed-out gathering still offered the form.** `/closeout/$eventId` rendered the full form for
  an event with a closeout and refused on submit; it says so up front now.

**Slice 5 landed 2026-09-11 — the seven gaps closed.** Every item the full-ticket audit recorded is
now fixed, with a test that fails without the fix:

1. **The audit trail is idempotent.** `submitCloseout`'s audit statement is guarded on a
   `notYetClosed` predicate — `closeable(...)` plus `NOT EXISTS (SELECT 1 FROM event_closeouts ...)` —
   and the batch was reordered so the audit runs **before** the insert. D1 runs a batch in declaration
   order inside one transaction, so an audit guarded on "not yet closed" that ran after the insert
   would never fire at all; the first version of this fix was silently dead. Three submits now leave
   one `closeout_submitted` row, and no audit row records an outcome the stored closeout lacks.
2. **Every stable error has its own sentence.** `closeout_no_end_time`, `event_not_found` and
   `rate_limited` joined the localized set in `ar`/`fr`/`en`, and `readCloseout` refuses an event with
   no `ends_at` **before** the form renders rather than after the host has filled it in — a permanent
   no belongs before the work, not after it.
3. **The surface is flag-gated.** `CloseoutPage` returns the refusal before the heading and the note,
   so a market with operations off renders an explanation rather than a form with an error under it.
4. **Flag-off stays recoverable.** `DestinationResult` gained a `transient` class and
   `operations_disabled` now uses it, so `guarded` holds the prompt instead of retiring it. A market
   that switches operations on still has its prompts.
5. **Logged _and_ alerted.** `libs/server-fns/src/alerts.ts` counts a swallowed failure into Analytics
   Engine — `closeout_intent_failed` indexed by market, `notification_schedule_arm_failed` global — so
   a threshold can be set on the thing that was previously only a log line nothing watched. The
   counter is itself wrapped: the paths that call it exist because nothing there may throw.
6. **`/activity` shows completion.** A new `getMyCloseoutStates` answers, for the caller's **own**
   hosted events only, which are closed and which are still open; the list shows "Closed out" or the
   link, and nothing at all for an event the server did not answer for. It is deliberately not folded
   into the hosted feed — that query is the public profile's too, and which of a host's gatherings did
   not happen is not a public fact. Cancelled events, events with no recorded end, and markets with
   operations off are absent from the answer, so the link is offered only where it could succeed.
7. **Long rosters are virtualised and the gaps in the component tests are closed.**
   `CloseoutRoster` renders plain list items up to forty people and switches to TanStack Virtual
   above that — a café table must not pay for the two-hundred-person cap. The marks live in the draft
   rather than in the DOM, which is what makes unmounting a row safe. A refused submission now moves
   focus to the reason, which otherwise sits above a roster the host cannot see past, and the retry
   keeps every answer. Thirteen new component tests cover the window, the threshold, focus and retry.

**Slice 6 landed 2026-09-11 — the submission is resumable.** A review found the half of CO-05 that
the gap audit had missed: the closeout commits in one atomic batch and everything after it — the
roster, the did-not-happen fan-out — runs one row at a time afterwards. D1 has no interactive
transaction that could make those one write, and two hundred marks is not a batch, so the work after
the closeout is made **resumable** instead of atomic.

Every write past the closeout was already idempotent — attendance on `ON CONFLICT DO UPDATE`, notices
on an id derived from the (event, member) pair — so the only thing preventing repair was the guard:
`already_closed` was a terminal error, and the retry that would have completed a half-written
submission was refused as a duplicate. It now resumes when the stored outcome agrees with the one
submitted, and still refuses when it does not, because changing the record of whether a gathering
happened is `correctCloseout`'s job and carries an operator permission and a reason.

That makes replay a normal path rather than an impossible one, so the attendance audit had to become
idempotent too — the same defect as the closeout's own audit, and the same fix: guard the audit entry
on "this outcome is not the one already recorded", and put it **first** in the batch, because D1 runs
a batch in declaration order and a `NOT EXISTS` evaluated after the upsert would see the row the
upsert had just written.

`backfillDidNotHappenNotices` covers the host who never retries. It anti-joins **per member** rather
than per event — nine notices out of ten is exactly the case it exists for — over a three-day window
rather than the prompt's fortnight, because telling somebody a gathering did not take place is only
worth saying while they might still be wondering.

The comment justifying the one-at-a-time loop was also wrong and is corrected: it claimed a failed
batch would leave a partial roster, but a D1 batch is atomic and a failed one leaves nothing. The
real reasons are per-mark refusal reporting and the two-hundred cap.

**Known limit.** The in-session retry is the recovery: the page keeps the draft and the stale read, so
pressing submit again after a failure completes the work. A host who reloads instead sees "Already
closed out" and cannot reach the form, and their roster stays partial until CO-08 gives an operator a
surface to record attendance. The notices half has no such limit — the nightly backfill covers it.

**Parent:** P1-009, P1-018, P1-023
**Requirements:** FR-E11, FR-E12, FR-E14, FR-M9; NFR-4, NFR-5, NFR-7 through NFR-11

Work:

- Add a host-only post-event closeout surface to the event feature in `apps/ui`.
- After an event is durably created, invoke an idempotent scheduling helper that upserts its
  post-event prompt intent and sets a Durable Object alarm for `endsAt + 30 minutes`. Intent/alarm
  failure is logged and alerted but never rolls back or duplicates the already-created event; the
  low-frequency recovery sweep derives and schedules missing intents for pre-existing or failed
  events. The alarm enqueues one localized closeout prompt through PWA push first and email as
  fallback.
- After `endsAt`, let the host select `held` or `did_not_happen`. For held events, present the valid
  going-RSVP list for attended/no-show marking and a non-negative anonymous walk-in count.
- Derive registered and total attendance server-side and show a complete review before submission.
- Collect `wouldHostAgain` and predefined friction categories without free-form operational notes.
- Make closeout idempotent, prevent duplicate submission, and map stable errors to actionable
  localized messages.
- If the outcome is `did_not_happen`, enqueue one idempotent, transparent localized notification to
  each frozen going member; do not invite feedback or imply the event was completed.
- Require the `communityOperations` flag for closeout/attendance surfaces, mutations, and prompt
  delivery. While disabled, keep the alarm/intent recoverable without notifying the host.
- Show closeout completion privately to the host; do not expose attendance outcomes or operational
  friction publicly.

Verification:

- Only the event host may submit before an admin override; submission is unavailable before
  `endsAt`, for a cancelled event, or for a forged attendee list.
- Component tests cover held/did-not-happen, zero attendees, walk-ins, long RSVP lists with TanStack
  Virtual, review, errors, retry, focus, and `ar`/`fr`/`en` RTL/LTR.
- D1 integration proves all closeout/attendance/audit writes are atomic and totals are derived.
- Alarm/Queue tests prove one host prompt, correct push/email fallback, recovery idempotency, and one
  participant notification for `did_not_happen` without feedback invitations.
- Failure-injection tests prove intent/alarm failure cannot roll back or duplicate event creation and
  is recovered without duplicating the intent or delivery.

### CO-06 — Add attendee feedback and post-event follow-up

**Status:** Implemented locally on 2026-09-14; staging and production promotion remain release actions.

**Parent:** P1-009, P1-018, P1-019, P1-023
**Requirements:** FR-E13, FR-E14, FR-M9; NFR-4, NFR-5, NFR-7 through NFR-11

Work:

- After a held closeout, enqueue one feedback invitation for each member marked attended.
- Create invitations only when the held closeout is submitted by `endsAt + 7 days`; the invitation
  expires at `endsAt + 14 days`, and a late closeout never reopens or extends it.
- Deliver push first with email behind it, per the ND-07 amendment above. A feedback invitation is
  not same-day disruption, so it never reaches SMS.
- Add an authenticated `apps/ui` feedback surface with the bounded value rating,
  `wouldReturn`, optional bounded comment plus required authored language when present, and clear
  privacy/retention explanation.
- Permit one idempotent submission per member/event and updates only through `endsAt + 14 days`.
  Reject non-attendees, late closeouts, and expired windows using trusted server time.
- After submission, offer the next relevant published event or the city discovery page. Do not
  fabricate recommendations when no real event exists.
- Aggregate structured answers for operations; keep comments out of Analytics and logs.
- Require the `communityOperations` flag for invitation production, feedback surfaces, and mutations.

Verification:

- Queue tests prove only attended members are invited, retries are idempotent, and push/email fallback
  remains correct.
- Server tests cover eligibility, feedback window, duplicate/update behavior, market scope,
  late-closeout behavior, authored language, session authorization, rate limiting, and typed errors.
- Component tests cover privacy copy, optional comment, success/empty next-event states,
  accessibility, and all locales/directions.

### CO-07 — Reduce repeat-host friction

**Parent:** P1-018, P1-023
**Requirements:** FR-E15, FR-M9; NFR-4, NFR-8 through NFR-11

Work:

- Add “Host another like this” after a held closeout and on the host's own past-event view.
- Prefill only the safe fields defined in §5 (city, venue, title, and description); clear schedule,
  IDs, slug, attendance, closeout, security responses, and any expired provider state. The event
  language is the active locale selected for the new wizard session.
- Send the host through the complete EC wizard review, validation, authentication, persistence,
  rate-limit, and WAF pipeline, preserving the current event-create Turnstile decision.
- Preserve the normal ability to change every prefilled value and make copied fields obvious rather
  than silently resubmitting an old event.
- Require the `communityOperations` flag to expose repeat-host entry points; final submission still
  uses the independently gated EC pipeline.

Verification:

- Tests prove forbidden fields are never copied and all prefilled fields are revalidated.
- A repeated event receives a fresh ID/slug/timestamps and appears correctly in city/host feeds.
- The flow works in all locales, directions, and target widths covered by EC-09.

Implementation status (2026-09-14): the host-only repeat-template server function enforces the
held-closeout and `communityOperations` gates; repeat links are available from held closeout,
hosted activity history, and the host's past event view. The wizard starts with safe editable fields,
clears its schedule and provider search state, and continues through the existing EC validation,
auth, persistence, and rate-limit pipeline. Server, draft, activity, closeout, and locale copy tests
are passing locally; staging/production promotion remains a release operation.

### CO-08 — Build the admin event-operations workspace

**Parent:** P1-009, P1-013, P1-019, P1-023
**Requirements:** FR-E13, FR-E14, FR-M1, FR-M4, FR-M6 through FR-M10; NFR-4, NFR-7 through NFR-11

Work:

- Build an operations home showing the next 28 days, overdue closeouts, did-not-happen events,
  delivery failures, moderation flags, and city schedule coverage using real data.
- Build an event table with TanStack Table and Virtual, filtered by market, city, operational state,
  host, and date window.
- Build an event detail view with canonical event data, host, RSVP/attendance summary, closeout,
  feedback aggregates, notification outcomes, and audit history.
- Permit authorized closeout correction/override only with a shared reason code, optimistic version,
  session authorization, rate limit, and an atomic audit write.
- Permit authorized person-level attendance correction only with a shared reason code, optimistic
  version, and an append-only atomic before/after audit entry containing both verified admin
  identities.
- Add a weekly operations review form/history backed by `operations_reviews`, requiring evidence
  window, structured bottleneck, bounded intervention, owner, due date, and later follow-up result.
- Reconcile correction side effects atomically: changing `held` to `did_not_happen` cancels pending
  feedback invitations, blocks further feedback, preserves already-submitted feedback under the
  retention/audit policy, sends the participant notice once, and removes the event from completed
  metrics; changing to `held` invites feedback only when still inside the seven-day closeout rule.
- Require `communityOperations` for operations, correction, backfill, and weekly-review routes and
  server functions.
- Apply centralized permission, identity-scoped DO limiting, and WAF coverage to every correction,
  backfill, and weekly-review mutation. These authenticated operations do not render Turnstile.
- Provide empty states that direct the operator to human action—recruit a host, confirm a venue,
  contact the event host, or review delivery—without inventing data or automating outreach.

Verification:

- Every list is market-scoped, paginated/cursor-based, indexed, and free of N+1 queries.
- Corrections cannot silently rewrite history; stale updates fail and the before/after operational
  state is reconstructible from audit evidence.
- A weekly review is stored in D1, market-scoped, visible in history, and never sent to a CRM.
- Transition-direction tests prove notification, feedback eligibility, audit, and metrics remain
  consistent when an authorized admin corrects the closeout outcome.
- Component and Miniflare tests cover filters, large lists, empty/error/loading states, permissions,
  closeout correction, and localized RTL/LTR behavior.

### CO-09 — Implement host trust, moderation, and audit

**Parent:** P1-013, P1-018, P1-023
**Requirements:** FR-M2 through FR-M4, FR-M6, FR-M9, FR-M10; NFR-4, NFR-5, NFR-7 through NFR-11

Work:

- Build a host operations list showing trust status, completed/did-not-happen events, attendance,
  recurring-host status, and moderation history without exposing unnecessary attendee PII.
- Permit authorized trust transitions `unreviewed -> verified|restricted` and reviewed recovery from
  `restricted`, each with stable reason, actor, timestamp, and audit record.
- Implement event moderation using existing cancellation/public-visibility semantics; any new
  moderation state must be added through a reviewed domain transition and migration.
- Wire user ban/unban through the centralized Better Auth/admin capability and record a local
  operations audit entry without duplicating the auth source of truth.
- Protect every trust, event, and user mutation with its declared permission, identity-scoped DO
  limit, and applicable WAF policy. These admin/session-bound mutations do not render Turnstile;
  public operations retain their own challenge policy.
- Require culturally/language-appropriate review and show authored content in its original language;
  do not auto-translate member content.

Verification:

- Moderator/admin permission differences are explicit and tested; no ad hoc role checks exist.
- Trust, event, and user actions are atomic with audit evidence and stable typed errors.
- Restricted/banned users cannot use protected community mutations according to the centralized
  policy, while historical public data follows the approved moderation rule.

### CO-10 — Deliver the community-health dashboard

**Parent:** P1-019, P1-023
**Requirements:** FR-M7, FR-M9, FR-M10; NFR-1, NFR-5, NFR-7, NFR-10 through NFR-12

Work:

- Implement indexed, market-scoped D1 aggregate repositories and validated server functions using
  the §6 pure formulas and golden vectors owned by CO-03.
- Build an admin dashboard for completed events by month, recurring hosts, 60-day host retention,
  repeat participation, RSVP conversion/no-shows, return intent, host-again intent, overdue
  closeouts, and four-week schedule coverage.
- Default to Algiers while retaining explicit market/city filters and preventing silent cross-market
  aggregation.
- Show counts, denominators, time windows, as-of time, and insufficient-sample states; never display
  a percentage without its evidence base.
- Emit non-PII product telemetry for successful closeout, attendance aggregate, feedback aggregate,
  repeat-event creation, moderation, and operational failures.
- Require `communityOperations` for dashboard routes and queries.
- Implement closeout backlog and schedule-loss attention states in the admin dashboard. Use the
  existing Workers Observability/Analytics account alerts for server-error and delivery-failure
  spikes, per-event Durable Object alarms for overdue closeout prompts, and only a daily
  low-frequency cron backstop for missed alarm/schedule coverage. No new alerting vendor is added,
  and the dashboard cannot automatically authorize P2-P4.
- Before raw records reach their retention boundary, write idempotent market-local monthly rows to
  `community_metric_snapshots`. Run the bounded retention/anonymization helpers from a monthly
  worker maintenance schedule, with dry-run counts, structured results, retry, and alerting; it may
  never use a broad unscoped delete.

Verification:

- Golden-data tests calculate every metric by hand across month/timezone boundaries, cancellations,
  did-not-happen events, walk-ins, new hosts, and zero denominators.
- Event listing/detail performance remains within NFR-1; dashboard queries have documented cost and
  indexes.
- Analytics payload tests prove no PII, comments, raw identifiers, or venue text is emitted.

### CO-11 — Rehearse operations, stage, and launch

**Parent:** P1-013, P1-019, P1-021, P1-023
**Requirements:** FR-E11 through FR-E15, FR-M1 through FR-M4, FR-M6 through FR-M10; NFR-4, NFR-7 through NFR-12

Work:

- Apply migrations to staging and deploy `apps/ui`, `apps/admin`, and `apps/worker-jobs` with the
  compatible shared libraries.
- Enable `communityOperations` for every configured market through migration `0027` and treat
  production promotion as a controlled release action.
- Verify Access plus Better Auth/RBAC, D1/DO/Queue/Analytics bindings, public Turnstile, WAF, FCM, Twilio,
  CSP, logs, alerts, and `workers.dev` isolation.
- Use the dedicated host/member/admin identities from CO-01; prove the admin's Access and Better Auth
  identities correlate before any privileged test.
- Run the operational staging flow across three timestamped checkpoints. Before start, create a
  uniquely marked event far enough ahead for the earliest configured reminder, use the minimum valid
  event duration, RSVP as the member, verify the reminder intent/alarm, and record the event ID. At
  the actual `startsAt`, prove RSVP mutation is rejected. Resume only after the actual `endsAt` to
  verify closeout, attendance, feedback invitation/submission, repeat-event prefill, admin
  correction/audit, weekly review, and metrics. Do not add a deployed clock override, fake
  completion endpoint, or fabricated production outcome.
- In local tests, use an injected clock/fake timers around domain and scheduling boundaries while
  Miniflare still supplies real D1, Durable Objects, and Queues.
- Exercise `ar`, `fr`, and `en`; RTL/LTR; mobile member/host surfaces; desktop/tablet admin surfaces;
  keyboard/focus; and failure/retry states.
- Keep Playwright outside CI under the current decision, but require the critical local/staging flows
  as release evidence.
- Conduct one dry-run weekly operations review using the dashboard and record the intervention chosen
  from real staging evidence.
- Apply production migrations before compatible Workers. Restrict production smoke checks to
  read/auth/security paths and isolated reversible feature-flag verification; do not create a fake
  community outcome. Record deployment versions, migration IDs, WAF/Access configuration, test IDs,
  metrics, and rollback points.

Rollback:

- Disable `communityOperations` for the affected market at its environment-scoped first-party
  configuration and verify the route and server-function gates preserve the core event flow.
  Moderation and host-trust access remains available for safety response.
- Roll back compatible Worker versions; never destructively reverse a D1 migration.
- Keep closeout/attendance/feedback records immutable during diagnosis except through audited forward
  correction.
- Retain uniquely marked staging records as test evidence or remove them only through explicit,
  target-validated, audited cleanup operations; never perform a broad destructive delete.

Verification:

- All definition-of-done items below have dated local, staging, and account-side evidence.
- CO-11 cannot be completed in one sitting unless real time has passed through all three checkpoints;
  checkpoint evidence records the event ID, identities, timestamps, and resumption owner.
- `docs/implementation-plan.md`, `docs/events-system-plan.md`, provisioning, secrets, server-function,
  observability, and admin documentation match verified reality before statuses become Complete.

## 9. Human community-operations cadence

The software supports but does not replace this weekly practice:

1. Review four-week Algiers calendar coverage and recruit/support hosts for real gaps.
2. Confirm venue readiness and host availability for the next seven days.
3. Resolve overdue closeouts, delivery failures, moderation items, and trust exceptions.
4. Review completed events, attendance/no-shows, repeat participation, host friction, and feedback
   response—not only RSVP totals.
5. Contact hosts and participants personally where qualitative understanding is required; do not
   infer motives from analytics.
6. Choose one operational or product intervention, assign an owner and date, and observe its effect.
7. Encourage strong participants to host and help existing hosts schedule the next event.
8. Record whether the bottleneck is host supply, calendar consistency, venue readiness, discovery,
   RSVP conversion, attendance, event quality, return behavior, or product reliability.

Success is not “the dashboard is complete.” Success is a community loop that repeatedly produces
good events, returning participants, and recurring hosts with decreasing founder intervention.

## 10. Required test matrix

| Layer                    | Required cases                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain                   | Closeout/attendance/feedback/trust/review schemas; locked enums; metric formulas; zero denominators; concrete windows/timezones; retention; repeat-host prefills      |
| Repository/D1            | Fresh/upgrade migrations; frozen RSVP eligibility; batched attendance; idempotency; append-only audit; weekly reviews; indexes; market scoping; legacy null end times |
| Server functions         | Correlated Access/Auth identity; authz; feature flag; public Turnstile boundary; DO limit; WAF evidence; host/admin ownership; typed errors; no leakage               |
| `apps/ui` components     | Closeout, long attendance list, feedback, return action, repeat hosting, loading/error/empty, all locales/directions/widths                                           |
| `apps/admin` components  | Secure shell, operations table/detail, trust/moderation, metrics, audit, permissions, filters, large lists, all locales/directions                                    |
| Worker/Queues            | Post-event alarms, host/member prompts, closeout/feedback windows, push success, email fallback, retry, DLQ, idempotency, recovery sweep                              |
| Playwright local/staging | Three-checkpoint create/reminder -> RSVP freeze -> real end -> closeout -> feedback -> repeat host -> admin correction/review -> metrics; auth rejection; no errors   |
| Operations               | Weekly D1 review record, real evidence interpretation, manual intervention, access revocation, alert response, feature-flag rollback                                  |

Repository verification for every code package:

```text
npx nx sync:check
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
```

Relevant Playwright remains a separate local/staging release gate.

## 11. Delivery boundaries and commit missions

1. `docs(community): lock operations contracts and cadence` — CO-01 documentation only.
2. `fix(events): close RSVP and notification correctness gaps` — CO-02, split RSVP from scheduling/delivery.
3. `feat(operations): add closeout attendance and feedback model` — CO-03 migration/domain/repositories.
4. `feat(admin): establish secure community operations shell` — CO-04.
5. `feat(events): add host closeout and attendance` — CO-05.
6. `feat(events): collect post-event feedback` — CO-06.
7. `feat(events): reduce repeat-host friction` — CO-07 (implemented locally; promotion pending).
8. `feat(admin): add event operations workspace` — CO-08.
9. `feat(admin): add host trust and moderation` — CO-09.
10. `feat(admin): report community health` — CO-10.
11. `test(community): verify the complete operations loop` — CO-11 code/test evidence; account-side
    configuration and deployment evidence remain operational records.

Do not combine the admin security foundation, D1 migration, host UI, worker scheduling, moderation,
and metrics dashboard into one change. Every mission must be independently real, tested, and free of
stubs/placeholders.

## 12. Risks and execution-time approvals

| Risk or dependency                                | Response                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Admin scope becomes a speculative CRM             | Enforce §3/§5 ownership; build only safety, measurement, exceptions, and demonstrated repetitive operations      |
| Hosts do not submit closeouts                     | Timely push/email prompt, visible overdue state, admin override with reason; do not infer held from elapsed time |
| Attendance marking feels bureaucratic             | Short mobile-first list, sensible eligible set, one review, aggregate walk-ins; measure completion friction      |
| Hosts misreport attendance                        | Audit actor/time, admin correction, anomaly review; do not publicly shame hosts or attendees                     |
| Feedback creates privacy or moderation burden     | Eligible attendees only, bounded optional comment, retention policy, restricted access, no public/raw analytics  |
| Small samples produce misleading percentages      | Always show numerator/denominator, window, and insufficient-sample state                                         |
| D1 closeout writes race or partially apply        | Conditional statements + `db.batch()`, unique constraints, optimistic version, real concurrent Miniflare tests   |
| Admin is reachable without both security gates    | Access JWT + `workers.dev: false` + Better Auth/RBAC; verify each gate independently in staging                  |
| Queue or provider failures suppress follow-up     | Durable alarms, Queue retry/DLQ, push-first/email fallback, delivery alerts, low-frequency recovery only         |
| A new dependency/service appears necessary        | Stop and ask before adding it; no approval is implied by this plan                                               |
| E2E remains outside CI                            | Require local/staging Playwright evidence; changing CI policy is a separate decision                             |
| Durable staging tests create user-visible records | Use authorized disposable identities/data and explicit safe cleanup; never delete broad or unresolved targets    |

## 13. Definition of done

- [x] EC-01 through EC-10 are Complete with recorded handoff evidence before CO implementation starts.
- [x] CO-02/P0-018 notification architecture is deployed and no longer Blocked. RSVP is session-bound
      and covered by authz plus rate limiting without a browser challenge.
- [ ] The weekly community-operations cadence has an owner and has been rehearsed with real evidence.
- [ ] RSVP create/cancel/restore is atomic before `startsAt` and immutable at/after it, preserving a
      stable attendance-eligibility set.
- [ ] Event outcome, attendance, feedback, host trust, weekly reviews, and operations audit have one
      Zod contract, market-scoped race-safe D1 persistence, a forward migration, and complete tests.
- [ ] Hosts close out events and mark attendance from `apps/ui`; they never need `apps/admin` for an
      ordinary event.
- [ ] Attended members receive feedback invitations only for a timely held closeout, can submit or
      update one private pulse through `endsAt + 14 days`, and receive a truthful return action.
- [ ] Hosts can start another event from safe prefilled values while passing the complete EC pipeline.
- [ ] `apps/admin` verifies Access, correlates its email/subject with the admin-owned Better Auth
      identity, applies centralized RBAC, has no placeholder page, and exposes only community
      operations, trust, moderation, audit, and metrics.
- [ ] Admin corrections are reasoned, optimistic, atomic, and auditable; no history is silently rewritten.
- [ ] Held/did-not-happen corrections reconcile feedback eligibility, pending notifications,
      participant communication, retained evidence, and completed-event metrics exactly once.
- [ ] Legacy events without `endsAt` are excluded from operations and metrics until an explicit
      audited backfill resolves their attention state.
- [ ] The concrete friction/reason enums, comment-language rule, retention periods, and
      deletion/export behavior are implemented and verified.
- [ ] Community metrics exactly implement §6, show evidence bases, use market timezones, and exclude
      anonymous walk-ins from person-level retention.
- [ ] Post-event prompts use Durable Object alarms -> Queue -> PWA push first -> email fallback, with
      retry, DLQ, idempotency, alerts, a host closeout prompt, and transparent did-not-happen member
      communication.
- [ ] `communityOperations` gates every intended UI/server entry point, is enabled for all configured
      markets, rolls back without data loss, and never disables moderation or host-trust safety controls.
- [ ] No PII, feedback comments, raw identifiers, or venue free text enters logs or Analytics Engine.
- [ ] All screens and notifications are complete in `ar`, `fr`, and `en`; RTL/LTR, WCAG 2.1 AA,
      loading/error/empty states, keyboard/focus, and responsive behavior are verified.
- [ ] Format, sync, typecheck, lint/boundaries, unit/integration, test, and build gates pass.
- [ ] The complete Playwright operations loop passes locally and across three real-time staging
      checkpoints while remaining outside CI; no deployed fake clock or completion endpoint exists.
- [ ] Staging/production migrations, deployments, Access, public Turnstile/WAF, alerts,
      smoke evidence, and rollback points are recorded.
- [ ] No sponsorship, challenge, talent, payment, expansion, speculative CRM, native app, or
      nonessential AI scope was introduced.

## CO-01 operating contract — **approved 2026-09-10**

Approved by the Founder on 2026-09-10. §5, §6 and §7 are frozen as written from this date; CO-03
onward builds against them. The role assignment, cadence, staging identity matrix and configuration
baseline below are in force.

### A. What needs approving rather than writing

§5, §6 and §7 are already written. CO-01 does not re-author them; it dates and approves them so
CO-03 onward can build against something that stops moving. One decision inside them is not the
author's to make:

**§5.21 retention — approved 2026-09-10.** Closeout, attendance, structured feedback, weekly reviews
and audit for 24 months; feedback comments for 12; current host trust for the account lifetime plus
24 months after closure; non-PII monthly aggregates indefinitely. PF-09 and PF-10 build directly on
these periods — an export states what it contains, a deletion states what survives — and may now
name them as the contract rather than as a proposal.

One standing caveat, recorded rather than resolved: these periods were not reviewed against Algerian
data-protection law by anyone qualified to do so. They are the product's stated retention policy, not
a legal opinion. A later legal review that shortens them is a change to this contract and to the copy
in PF-09 and PF-10, not a defect in either.

### B. Who may act as `moderator` and `admin`

**Approved 2026-09-10:** one `admin`, the Founder, named by account. **No `moderator` at launch.**

The reason for no moderator is not caution, it is honesty about the code: `moderator` in
`libs/auth/src/rbac.ts` currently grants exactly the permissions `member` has. Assigning it today
would hand somebody a title and no capability, and would create a person who believes they can act.
The role gains meaning when CO-03/CO-04 add the §5.12 actions — operations read, metrics read, event
moderation, closeout override, host-trust update, user moderation, audit read — and the first
moderator should be named then, against a role that does something.

**Granting.** A role change is three things done together, or it is not done: the Better Auth role
set through the admin plugin, the Cloudflare Access policy updated to include that person, and a
dated row added to the account matrix in §D. §5.18 already requires the verified Access email to
equal the verified Better Auth email; a mismatch must fail closed rather than be reconciled by hand.

**Revoking.** The same three, reversed, plus revoking that person's live sessions. That last step is
available now — PF-07d added owner-bound session revocation, and revoking a session also removes
that device's push registration.

**Emergency action.** Any moderation or correction taken outside the weekly cadence is legitimate,
and is reviewed at the next weekly review and recorded in the `operations_reviews` entry for that
week with its reason. The review is not permission to act; it is the record that acting was
noticed. Until CO-08 persists reviews, the record is the markdown log in §C.

### C. The weekly Founder / community-operator cadence

**Owner:** the Founder, until a second operator exists. **When:** weekly, same slot, whatever slot
survives four consecutive weeks — a cadence nobody keeps is worse than none. Approved 2026-09-10;
the first review is due within seven days of that date.

**Agenda**, fixed, in this order:

1. The next four weeks of events, against the operating target of roughly eight completed events per
   month (§6, _Four-week schedule cover_)
2. Host availability and venue readiness
3. Overdue closeouts (§6: ended more than 24 hours ago, not cancelled, no closeout)
4. Attendance and no-shows
5. Repeat participants and recurring hosts
6. Host friction, from the locked §5.22 enum
7. Moderation actions taken since the last review, including any emergency action
8. **One** named intervention, with an owner and a due date

**The record.** §5.25 fixes the fields: scope, evidence window, bottleneck (from the locked §5.22
list), intervention, owner, due date, follow-up result. Until CO-08 ships `operations_reviews` and
CO-11 accepts it, the review is written to a dated markdown log in this repository using exactly
those field names — so the first persisted review is a transcription rather than a redesign. The
plan's verification bar already says the first persisted review is a CO-08/CO-11 outcome, not a
CO-01 one.

### D. Staging identity matrix

Three dedicated identities, none of which may be a production community account (§CO-01). Approved
2026-09-10; the addresses are filled in when the identities are first seeded, which is a CO-02
prerequisite rather than a CO-01 deliverable:

| Identity         | Role     | Access policy                                                             | Environment  | Owner   | Expiry / revocation       | Permitted test data                                       |
| ---------------- | -------- | ------------------------------------------------------------------------- | ------------ | ------- | ------------------------- | --------------------------------------------------------- |
| `staging-host`   | `host`   | none (product app is not Access-gated)                                    | staging only | Founder | revoked at CO-11 sign-off | events it creates, cleaned up in the same session         |
| `staging-member` | `member` | none                                                                      | staging only | Founder | revoked at CO-11 sign-off | RSVPs and feedback on `staging-host` events only          |
| `staging-admin`  | `admin`  | admin app policy, Access email **equal to** its Better Auth email (§5.18) | staging only | Founder | revoked at CO-11 sign-off | closeout overrides and corrections on staging events only |

Roles are seeded explicitly and revoked explicitly; none is left standing after CO-11.

### E. Configuration baseline, read from the account 2026-09-15

| Surface             | State                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1                  | `founders-coffee-db-production` and `founders-coffee-db-staging`; `verified-prof` deleted 2026-09-10 (see F)                                                             |
| Workers             | 8 scripts — `ui`, `admin`, `dashboard`, `worker-jobs`, each in staging and production; CO-02/CO-03 are deployed in both, and CO-04/CO-05 are verified on staging         |
| Queues              | 8 — `notifications`, `embeddings-jobs`, `reconcile` and `dlq`, each per environment. All have one consumer except both DLQs, which correctly have none                   |
| R2                  | `founders-coffee-assets-{dev,staging,production}`, created 2026-09-09 for PF-06, all empty, all WEUR                                                                     |
| Access applications | staging and production admin applications are configured; Access/Better Auth correlation, operator role, and production CSRF-origin behavior were verified on 2026-09-15 |
| Analytics Engine    | Public Worker binding and `events_created` write verified during EC-10; the current token cannot read account-side dashboards                                            |
| Secrets             | not readable by design; recorded from the EC-10 preflight rather than re-read                                                                                            |

### F. Two things the baseline turned up

**Admin Access is configured and verified in both environments.** The staging application was
driven through Access and the admin-owned Better Auth session on 2026-09-11. Production operator
setup, Access/Better Auth correlation, role authorization, and CSRF-origin behavior were verified on
2026-09-15. Requests without a valid assertion continue to fail closed.

**`verified-prof` was a D1 database belonging to a different product, and has been deleted.**
Identified 2026-09-10: created 2026-01-20, holding a PascalCase schema — `User`, `Account`,
`Session`, `Skill`, `Badge`, `Achievement`, `AnalysisJob`, `Verification` — under its own migrations
`0001_init.sql` and `0002_add_verification.sql`. Every table was empty. It was not founders-coffee's,
which uses snake_case throughout, and it was referenced by no `wrangler.jsonc`, migration or binding
here. The Founder confirmed it belonged to a retired product and it was deleted the same day.
Recorded so the account inventory reads as two databases rather than three, and so nobody adding
operational tables in CO-03 goes looking for a third.

### G. What CO-01 does not do

It writes no schema, no code and no migration — CO-03 owns those. It does not capture attendance,
feedback or outcomes for the EC-10 smoke event: that event proves the creation slice and nothing
else, and §2 is explicit that it is never reused as a post-event fixture. It admits no commercial
metric to the baseline. And it does not start CO-02.
