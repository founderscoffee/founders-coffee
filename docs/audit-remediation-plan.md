# Audit Remediation Plan

| Field          | Value                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | Active; AR-11 complete, AR-01 through AR-10 planned                                                                                                                                                  |
| Last reviewed  | 2026-09-01                                                                                                                                                                                           |
| Scope          | Defects and rule deviations found by the repository-wide audit at `1167e0d` on `develop`, excluding work already owned by an existing plan                                                           |
| Parent tickets | P0-018, P0-020, P0-021, P1-008, P1-009, P1-018, P1-019                                                                                                                                               |
| Requirements   | FR-E3, FR-E4, FR-N1, FR-N3; NFR-3, NFR-4, NFR-7, NFR-9, NFR-10, NFR-11, NFR-12                                                                                                                       |
| Related plans  | [Implementation plan](./implementation-plan.md), [Event Creation Remediation Plan](./event-creation-remediation-plan.md), [Community Operations Plan](./community-operations-implementation-plan.md) |

This plan records defects found by auditing the repository against [`AGENTS.md`](../AGENTS.md), the
[SRS](./srs.md), and the [implementation plan](./implementation-plan.md), and by executing every
verification gate locally. It is remediation work, not new product scope. It does not authorize
sponsorship, challenges, talent, payments, or expansion, all of which remain behind the
[community validation gate](./release-strategy.md).

This plan does not take ownership of work an existing plan already owns. Event creation stays with
the [Event Creation Remediation Plan](./event-creation-remediation-plan.md); the scheduler
replacement, delivery-channel fallback, and post-event operations stay with the
[Community Operations Plan](./community-operations-implementation-plan.md). Section 6 lists what was
found but deliberately left with its existing owner.

AR-01 is a prerequisite for every other ticket in the repository, not only for this plan: continuous
integration is currently red, so no pull request can pass verification until it is resolved.

## 1. Objective

Close the gap between the behavior the constitution and SRS require and the behavior the code
actually exhibits, in the areas the audit proved rather than inferred.

Completion means:

```text
verification gates
  -> all seven pass, including the dependency audit
scheduled notifications
  -> every row reaches a terminal state
  -> a failure retries within budget and falls back to email as documented
  -> no row can be dispatched twice by overlapping sweeps
RSVP
  -> a rejected full-capacity attempt writes nothing
  -> a concurrent duplicate returns the typed already_rsvpd error
state-changing endpoints
  -> every one declares a permission and is rate limited
  -> anonymous and metered endpoints are additionally protected
notification content
  -> localized in ar, fr, and en from libs/i18n
responses
  -> carry the required security headers and a strict CSP
enforcement
  -> boundary lint covers every component directory
  -> coverage gates run on libs/domain and libs/server-fns
```

This plan does not change the locked stack, add a dependency, introduce an external service, or
alter the community-only release boundary.

## 2. Audit baseline

Audited at `1167e0d` on `develop`, with nineteen uncommitted files in the working tree implementing
the EC-06 Turnstile and rate-limiter work. Every finding below was traced to a file and line. None
was inferred from documentation alone.

### Verification gates executed

| Gate                           | Result | Evidence                                                  |
| ------------------------------ | ------ | --------------------------------------------------------- |
| `npm run format:check`         | Pass   | Prettier clean repository-wide                            |
| `npx nx sync:check`            | Pass   | TypeScript project references in sync                     |
| `npx nx run-many -t typecheck` | Pass   | 15 projects, strict TypeScript 6                          |
| `npx nx run-many -t lint`      | Pass   | Includes Nx module-boundary rules                         |
| `npx nx run-many -t test`      | Pass   | 363 tests across 66 files against real Miniflare bindings |
| `npx nx run-many -t build`     | Pass   | 14 projects                                               |
| `npm audit --audit-level=high` | Fail   | Exit code 1; see AR-01                                    |

### Conformance evidence to preserve

These were verified and must not regress: zero `any`, zero `TODO`, and zero skipped tests in
committed code; three justified `@ts-expect-error` directives, all in one React DOM shim; 207 i18n
message keys with exact parity across `ar`, `fr`, and `en`; every component import of
`@founders-coffee/db`, `@founders-coffee/domain`, and `@founders-coffee/server-fns` is type-only;
Turnstile verification pins action and hostname, detects replay, and fails closed; Better Auth pins
`cf-connecting-ip` so a client cannot select its own rate-limit bucket; no interactive D1
read-then-write transaction exists anywhere; the admin Worker verifies the Access JWT in-process;
and production deployment refuses any branch but `main`.

### Findings

Severity reflects production impact, not effort. "Known" means the implementation plan already
records the defect and refuses to mark the work complete; "New" means it does not.

| ID   | Severity | Status | Finding                                                                                | Ticket |
| ---- | -------- | ------ | -------------------------------------------------------------------------------------- | ------ |
| F-01 | Blocking | New    | `npm audit --audit-level=high` exits 1, so CI fails at head                            | AR-01  |
| F-02 | Blocking | New    | Push rows with no configured provider never reach a terminal state and jam the sweep   | AR-02  |
| F-03 | Blocking | New    | The SMS-to-email fallback branch is unreachable; one failure is terminal               | AR-02  |
| F-04 | Blocking | Known  | A rejected full-capacity RSVP is still inserted                                        | AR-04  |
| F-05 | High     | New    | A concurrent duplicate RSVP rethrows the raw driver error past the throw boundary      | AR-04  |
| F-06 | High     | New    | The three map server functions are anonymous, unauthorized, and unrate-limited         | AR-05  |
| F-07 | High     | New    | The sweep claims no rows, so an overrunning run re-dispatches them                     | AR-03  |
| F-08 | High     | Known  | One-minute D1 polling; the notifications queue is coded but bound nowhere              | §6     |
| F-09 | Medium   | Known  | No CSP or security headers exist anywhere in the codebase                              | AR-08  |
| F-10 | Medium   | New    | Notification bodies are hardcoded English; the base URL is hardcoded to production     | AR-07  |
| F-11 | Medium   | New    | The boundary lint rule misses `features/<domain>/components/`; apps carry no layer tag | AR-09  |
| F-12 | Medium   | New    | The coverage gates required by §12 were never configured                               | AR-09  |
| F-13 | Medium   | Known  | The critical-flow release-gate E2E does not exist                                      | §6     |
| F-14 | Medium   | New    | Three state-changing endpoints declare no permission; the waitlist has no Turnstile    | AR-06  |
| F-15 | Low      | New    | Six correctness and hygiene defects, individually small                                | AR-10  |
| F-16 | Low      | New    | Four files exceeded the 300-line cap introduced 2026-09-01 — resolved 2026-09-01       | AR-11  |

## 3. Locked remediation decisions

1. **The dependency-audit gate stays as written.** `npm audit --audit-level=high` remains a required
   CI step. The advisory is resolved through the existing root `overrides` block, in the same way the
   eleven transitive pins already present were resolved. Lowering or removing the gate is not an
   acceptable remediation.
2. **A scheduled notification always reaches a terminal state.** Every dispatch path resolves the row
   to `sent` or `failed`, including the case where no provider is configured for its channel. No
   input may leave a row selectable forever.
3. **Retryable and terminal failures are distinct.** `failed` means the retry budget is spent. A
   retryable failure keeps the row `pending` with a deferred `send_at`, so the documented
   three-attempt SMS budget and its email fallback become reachable.
4. **Cancellation is not failure.** Cancelling an RSVP or an event must not write the same status
   that a delivery failure writes; operational metrics must be able to tell them apart.
5. **Check-then-write stays atomic on D1.** The RSVP capacity decision moves into a single statement
   whose insert is itself conditional on remaining capacity. A guarded update paired with an
   unguarded insert is not atomicity.
6. **The throw boundary is absolute.** Every anticipated failure crossing a server function is a
   typed `AppError`. A constraint violation is anticipated.
7. **Metered third-party calls are never anonymous and unmetered.** Any server function that forwards
   to a billed external API carries identity-scoped rate limiting at minimum, independent of the edge
   WAF rule, whose account-side state is separately unverified.
8. **User-facing notification copy lives in `libs/i18n`.** No user-facing string is authored in
   `libs/server-fns`. Environment-specific URLs come from configuration.
9. **Enforcement mechanisms are themselves tested.** A lint rule or coverage gate that silently fails
   to cover its target is a defect equal to the code it was meant to catch.
10. **No new package or platform service.** If execution proves the current bindings, providers, or
    platform primitives insufficient, implementation pauses for explicit approval before adding
    anything.

## 4. Work breakdown and sequence

The `AR-*` identifiers are local work packages under the existing parent tickets. They do not replace
the repository's P0/P1 ticket IDs.

Recommended order: AR-01 first and alone. Then AR-02, AR-04, and AR-05, which are the defects with
production consequences. Then AR-09, which restores the mechanisms that would have caught several of
the others. AR-03, AR-06, AR-07, AR-08, and AR-10 follow in any order the schedule allows.
AR-11 is complete.

### AR-01 — Restore the dependency-audit gate

**Parent:** P0-020
**Requirements:** NFR-4, NFR-12
**Status:** Planned

Closes F-01.

Work:

- Add `browserslist` to the root `package.json` `overrides` block at the first version clearing
  GHSA-c83g-rgw3-j3cx and GHSA-73wf-gq98-2v4g, alongside the existing transitive pins.
- Refresh `package-lock.json` and confirm the override reaches both dependents, `@nx/js` through
  `@babel/helper-compilation-targets` and `@serwist/vite` through `@serwist/utils`.
- Record that the package is a build-time transitive with no Worker runtime exposure, so the change
  carries no runtime risk.

Verification:

- `npm audit --audit-level=high` exits 0.
- `npm ci` from a clean checkout resolves the pinned version.
- Repository-wide format, sync, typecheck, lint, test, and build gates pass without E2E.

### AR-02 — Guarantee terminal state and a reachable fallback for scheduled notifications

**Parent:** P0-018, P1-009
**Requirements:** FR-N1; NFR-3, NFR-7
**Status:** Planned

Closes F-02 and F-03. These are one defect in two forms: the status lifecycle allows a row to be
neither delivered nor retired.

Current behavior:

- `apps/worker-jobs/src/jobs/notification-sweep.ts:73` dispatches on `channel === 'push' && push`.
  When `createPushProvider` returns `null` because Firebase credentials are absent, a push row
  matches no branch and is neither marked sent nor failed. It remains `pending` and is re-selected by
  every subsequent sweep. Because `listPendingNotifications` takes the oldest hundred due rows,
  roughly one hundred stuck rows consume the entire window and all delivery stops silently, across
  every channel. Each RSVP enqueues two push rows.
- `libs/db/src/notifications.ts:90–139` writes `status: 'failed'` on the first failure but creates the
  fallback row only when `newAttempts >= 3`. Nothing anywhere resets a row to `pending`, so `attempts`
  never exceeds 1 and the branch is unreachable. The schema comment at `libs/db/src/schema.ts:374`
  documents an email retry after three attempts that cannot occur.

Work:

- Resolve every dispatched row explicitly. An unroutable row — unknown channel, or a channel whose
  provider is unconfigured — is marked `failed` with a distinguishable reason, or is never enqueued
  when the deployment has no provider bound for that channel.
- Separate retryable from terminal outcomes in `markNotificationFailed`: while attempts remain,
  increment `attempts`, record `last_error`, defer `send_at` by a documented backoff, and keep the row
  `pending`. Write `failed` only when the budget is exhausted, creating the fallback row at that
  moment.
- Give `listPendingNotifications` a deterministic `ORDER BY send_at, id` so selection is stable and
  the partial index is used predictably.
- Replace the deterministic `${existing.id}_fb` fallback identifier with an id-factory value, so a
  second fallback for the same row cannot collide on the primary key.
- Stop writing `status: 'failed'` for cancellation in `cancelNotificationsByEvent` and
  `cancelNotificationsByUserEvent`; introduce a distinct cancelled state with the reviewed migration
  it requires.

Verification:

- Miniflare and D1 integration tests prove: a push row with no configured provider reaches a terminal
  state in one sweep; a hundred previously stuck rows cannot block a newly due SMS row; a retryable
  SMS failure remains `pending` with a deferred `send_at` and is retried; the email fallback row is
  created exactly once when the budget is exhausted; a cancelled row is distinguishable from a failed
  row.
- A regression test asserts that no dispatch path can leave a selected row `pending` with unchanged
  `attempts`.

### AR-03 — Claim scheduled notifications before dispatch

**Parent:** P0-018, P1-009
**Requirements:** FR-N1; NFR-3, NFR-7
**Status:** Planned

Closes F-07.

Current behavior: `libs/db/src/notifications.ts:56` selects up to a hundred due rows and the sweep
processes them serially, each making an outbound call to Twilio, Cloudflare Email, or FCM. There is
no lease, claim, or in-flight state. A run exceeding sixty seconds overlaps the next cron tick, which
re-selects the same still-`pending` rows and dispatches them again. A hundred serial provider
round-trips exceeding a minute is not an edge case.

Work:

- Claim atomically before dispatch: a single `UPDATE ... SET status = 'processing' WHERE status =
'pending' AND send_at <= ?` bounded by the sweep limit, followed by a read of the claimed set.
- Ensure a claimed row cannot be stranded if the invocation dies mid-run: either bound the claim with
  a timestamp that a later sweep may reclaim, or keep the claim window smaller than the retry budget.
- Add the reviewed migration for the new status value.

Verification:

- An integration test runs two concurrent sweeps against the same due set and asserts each row is
  dispatched exactly once.
- A test proves a claimed row abandoned by a failed invocation becomes eligible again within the
  documented window.

Note: AR-03 is superseded if the queue migration under P0-018 lands first. See section 6.

### AR-04 — Make RSVP capacity atomic and its duplicate error typed

**Parent:** P1-008
**Requirements:** FR-E3, FR-E4; NFR-4, NFR-10
**Status:** Planned

Closes F-04 and F-05. Both live in the same twenty lines.

Current behavior:

- `libs/db/src/rsvps.ts:37–54` batches a capacity-guarded `UPDATE` with an unguarded `INSERT`. At
  capacity the update changes zero rows, but the insert still commits — the batch never errors, so
  nothing rolls back. The caller reads `changes === 0`, returns `event_full`, and the member sees
  "This event is full" while being recorded as `going` with the counter un-incremented. A retry then
  returns `already_rsvpd`. The attendee list and the counter permanently disagree.
- `libs/server-fns/src/rsvps/resolver.ts:86–90` catches only `error.message === 'event_full'`, a
  string `createRsvp` never throws. The repository doc comment claims the caller maps the `UNIQUE`
  violation to `already_rsvpd`; it does not. A genuine race therefore rethrows the raw driver error,
  which `AGENTS.md` §16 forbids.

Work:

- Replace the batch with a single atomic statement whose insert is conditional on remaining capacity,
  in the shape `INSERT INTO event_rsvps ... SELECT ... WHERE EXISTS (SELECT 1 FROM events WHERE id = ?
AND (capacity = 0 OR rsvps < capacity))`, paired with the guarded counter increment in one batch so
  a rejected attempt writes nothing.
- Map the `UNIQUE(event_id, user_id)` violation to `err(AppError('already_rsvpd'))` and delete the
  unreachable `'event_full'` message comparison.
- Correct the doc comment on `createRsvp` so it describes what the code does.
- Confirm the same review for `cancelRsvp`, whose two-statement decrement is deliberate and
  documented; keep it only if the review confirms the reasoning still holds.

Verification:

- Miniflare and D1 tests prove: an RSVP at exactly full capacity inserts no row and leaves the counter
  unchanged; concurrent RSVPs against the final seat produce exactly one attendee; a concurrent
  duplicate returns `already_rsvpd` rather than an untyped throw; unlimited capacity, expressed as
  `0`, continues to accept.
- A test asserts the attendee row count and the denormalized counter agree after every scenario.

### AR-05 — Rate-limit the map server functions

**Parent:** P1-018
**Requirements:** NFR-4
**Status:** Planned

Closes F-06.

Current behavior: `libs/server-fns/src/maps/rpc.ts:18–33` defines `getHostMapContext`,
`searchEventVenues`, and `reverseEventVenue` with a validator and nothing else — no session, no
permission, no rate-limit middleware, no Turnstile. Each forwards to the Mapbox Geocoding API, which
bills per request. Any caller reaching `/_serverFn/` can drive that bill. The only current defence is
the edge WAF rule at 120 requests per minute per colo and IP, whose account-side existence is recorded
as unverified in [`deployment-evidence.md`](./deployment-evidence.md).

Work:

- Compose the existing `rateLimit()` middleware onto all three functions with a policy sized for the
  host wizard's real interaction pattern, keyed on the caller identity, falling back to
  `cf-connecting-ip` for anonymous callers.
- Decide and record whether venue search requires a session. It is reached only from the host wizard,
  which EC-06 already routes through authentication at submission; if the wizard permits anonymous
  browsing before that boundary, keep the endpoints anonymous and rely on the IP-scoped policy.
- Confirm the policy does not degrade the legitimate wizard flow, in which typing a venue name issues
  several searches in quick succession.

Verification:

- Miniflare integration tests prove each endpoint returns the typed `rate_limited` error beyond its
  policy and serves a normal wizard session without tripping.
- A component or integration test proves a rate-limited venue search surfaces a localized, recoverable
  error state rather than a broken map.

### AR-06 — Complete authorization and bot protection on the remaining state-changing endpoints

**Parent:** P1-018
**Requirements:** NFR-4
**Status:** Planned

Closes F-14.

Current behavior: `AGENTS.md` §7 requires every server function to declare a permission enforced by
the shared authz middleware. `libs/server-fns/src/profile.ts:91` (`setHomeLocation`) and
`libs/server-fns/src/push/rpc.ts:23,44` (`registerPushTokenFn`, `removePushTokenFn`) mutate state
behind `authMiddleware` alone, which attaches a session but enforces nothing, and none is rate
limited. Separately `libs/server-fns/src/waitlist/rpc.ts:28` (`joinWaitlist`) is anonymous and
state-changing with a rate limit but no Turnstile, making it the most spammable write path in the
application, and it collects email addresses.

Work:

- Add `requirePermission` to the three authenticated writes, extending the RBAC resource/action model
  only as far as those writes require.
- Add identity-scoped rate limits to the three, sized for their real usage — home location changes
  rarely, push tokens change on install and logout.
- Add Turnstile to `joinWaitlist` using the provider and middleware EC-06 established, with the
  action name distinct from `create_event`.
- Audit the remaining server functions for the same omission and record the result, so the endpoint
  audit named in P1-018 is closed rather than sampled.

Verification:

- Miniflare tests prove each endpoint rejects an unauthorized role, rejects beyond its rate limit, and
  succeeds for a permitted caller.
- A test proves the waitlist rejects a missing or replayed Turnstile response and fails closed when
  the secret is absent outside local development.

### AR-07 — Localize notification content

**Parent:** P1-009
**Requirements:** FR-N3; NFR-9
**Status:** Planned

Closes F-10.

Current behavior: `libs/server-fns/src/notifications/producer.ts:38–131` builds SMS, email, and push
bodies from English string literals. The `locale` it receives selects a date format and nothing else,
so a member who chose Arabic receives an Arabic interface and an English text message. FR-N3 requires
localized notifications and `AGENTS.md` §9 forbids hardcoded user-facing strings. The same file
hardcodes `https://founders.coffee`, so staging notifications link to production.

Work:

- Move all three template families — confirmation, 72-hour reminder, 24-hour reminder — into
  `libs/i18n` messages with `ar`, `fr`, and `en` variants, preserving the existing key-parity
  discipline.
- Render the body from the recipient's stored locale at send time, falling back to the market default
  and then `ar`, matching the documented resolution order.
- Take the event base URL from configuration rather than a literal, so each environment links to
  itself.
- Keep the existing HTML escaping on interpolated user-generated content.

Verification:

- Unit tests prove each template renders in all three locales with correct interpolation and that
  Arabic output is RTL-safe.
- An i18n parity test fails if any notification key is missing from any locale.
- An integration test proves a staging-configured environment produces staging links.

### AR-08 — Add secure response headers and a strict CSP

**Parent:** P1-018
**Requirements:** NFR-4
**Status:** Planned

Closes F-09.

Current behavior: searching the repository for `Content-Security-Policy`, `Strict-Transport-Security`,
`X-Frame-Options`, or `nonce` returns nothing. `AGENTS.md` §10 requires a secure-headers middleware
and a strict CSP with nonces. The public application loads third-party script from Cloudflare
Turnstile, Mapbox, and Firebase, and renders host-authored titles, venue names, and descriptions, so
it is the application that most needs the header it does not send. Session cookies are already
correctly `Secure; HttpOnly; SameSite=Lax`.

Work:

- Add a shared secure-headers middleware applied at the Worker entry of `apps/ui` and `apps/admin`.
- Author a strict CSP with per-request nonces, enumerating the script, style, connect, image, and
  frame sources the three approved integrations genuinely require. Do not weaken the policy to
  accommodate an integration without recording why.
- Add `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, and a frame policy.
- Roll out in report-only mode first and record the violations observed before enforcing.

Verification:

- An integration test asserts the headers are present on document and server-function responses.
- A Playwright pass over the host wizard, login, and event detail records zero CSP violations in
  enforcing mode across `ar`, `fr`, and `en`.

### AR-09 — Repair the two enforcement mechanisms

**Parent:** P0-001, P0-021
**Requirements:** NFR-10, NFR-11
**Status:** Planned

Closes F-11 and F-12. These are the mechanisms that would have caught several of the other findings.

Current behavior:

- App projects carry only `type:app` and `domain:*` tags — no `layer:` tag — so
  `@nx/enforce-module-boundaries` asserts only that apps depend on libraries, and none of the layer
  constraints apply to application code. The gap is covered by the local rule
  `no-server-fns-in-components`, whose path test at `eslint.config.mjs:46` matches
  `/\/src\/(components|lib)\//`. That misses `features/<domain>/components/`, the exact directory
  `AGENTS.md` §3 designates for domain components. Nothing violates it today and the type-only
  discipline is spotless; the guard simply would not catch a regression.
- `AGENTS.md` §12 requires coverage gates on `libs/domain` and `libs/server-fns`. No `coverage`
  configuration exists in any vitest config, and CI never collects it. F-02, F-03, and F-05 all sit in
  code paths with no test.

Work:

- Widen the local rule's path test to any `components/` path segment and add a fixture test proving it
  fires for `features/<domain>/components/`.
- Add `layer:ui` to the application projects so the Nx layer constraints engage, and resolve whatever
  the newly active constraints surface. Route files and `features/*/api.ts` legitimately reach the
  server layer; encode that exception deliberately rather than by omission.
- Configure vitest coverage for `libs/domain` and `libs/server-fns` with thresholds set from a
  measured baseline, and collect it in CI.

Verification:

- A deliberate violation in `features/<domain>/components/` fails lint.
- Coverage runs in CI and fails below threshold.
- Repository-wide gates still pass with the layer tags applied.

### AR-10 — Correctness and hygiene cleanup

**Parent:** P1-018, P1-019
**Requirements:** NFR-4, NFR-7, NFR-10
**Status:** Planned

Closes F-15.

Work:

- Add a Maghreb or EU location hint at Durable Object creation, as `AGENTS.md` §11.5 requires. Both
  `libs/server-fns/src/rate-limit.ts:37` and `apps/ui/src/server.ts:63` call `idFromName` bare, so each
  object is created wherever its first request happens to land.
- Rename `SEVEN_DAYS_MS` at `libs/server-fns/src/notifications/producer.ts:22`. The value, 72 hours, is
  correct for the 72-hour reminder; only the name is wrong.
- Give the rate-limiter Durable Object an eviction path. One object per identity-and-action pair
  accumulates storage indefinitely with no alarm to clear an idle bucket.
- Replace the `"latest"` specifiers for the TanStack router and start packages in `apps/ui`,
  `apps/dashboard`, `apps/admin`, and `libs/server-fns` with pinned ranges, completing the pinning
  started in `727dbc4`. The lockfile keeps CI reproducible today, but any `npm install` can move the
  framework silently.
- Remove the two `apps/api` references in `AGENTS.md` §2 and §16. The application was deleted; a rule
  forbidding work on something that no longer exists misleads the next reader.
- Replace the untyped `env` casts in `libs/server-fns/src/rate-limit.ts` and
  `libs/server-fns/src/config.ts` with the typed `Env` from `libs/infra` if it already carries the
  bindings; otherwise record why the cast is unavoidable.

Verification:

- Repository-wide format, sync, typecheck, lint, test, and build gates pass.
- A test proves a new rate-limiter bucket is created with the configured location hint.

### AR-11 — Split the files grandfathered past the 300-line cap

**Parent:** P0-001
**Requirements:** NFR-10
**Status:** Complete — 2026-09-01

`AGENTS.md` §5 caps files at 300 lines, enforced by `max-lines` in `eslint.config.mjs`. Four files
predated the cap and were carried as grandfathered exemptions. All four are split and the
grandfathered block is removed; only the two permanent exemptions remain.

Work:

- Split each file by responsibility. Reformatting to fall under the cap was explicitly not a fix.
- Delete each file's entry from the grandfathered block as it is split, and remove the block once
  empty.

Completion evidence:

| Original                                         | Lines | Now | Split into                                                                                                                          |
| ------------------------------------------------ | ----- | --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/ui/src/durable-objects/EventLiveDO.ts`     | 521   | 289 | `event-live/protocol.ts` (85), `event-live/session.ts` (86), `event-live/roster.ts` (108)                                           |
| `apps/ui/src/components/host/HostCreatePage.tsx` | 449   | 184 | `useHostCreateWizard.ts` (204), `HostWizardHeader` (55), `HostMapPanel` (78), `HostVenueStep` (56), `HostDetailsStep` (90)          |
| `libs/server-fns/src/events/resolver.test.ts`    | 479   | 141 | `resolver.fixtures.ts` (131), `resolver.boundary.test.ts` (56), `resolver.persistence.test.ts` (154), `resolver.reads.test.ts` (43) |
| `libs/server-fns/src/maps/mapbox-provider.ts`    | 336   | 185 | `mapbox-schemas.ts` (66), `mapbox-filters.ts` (124)                                                                                 |

- `EventLiveDO` now coordinates only and holds no state of its own: open sockets moved to an
  `EventConnections` registry, roster and host state to an `EventRoster` that write-throughs to
  `ctx.storage`, connection authorization to `event-live/session.ts`, and the wire contract to
  `event-live/protocol.ts`.
- The split collapsed a real duplication: `authenticateConnection` and `handleAuth` carried
  near-identical post-verification logic and now share one `applyVerifiedSession` (AGENTS.md §1.2).
  `walking_in` and `running_late` likewise share one attendee-status handler.
- `HostCreatePage` is layout and wiring only; wizard state, derived flags, and the publish handler
  moved to `useHostCreateWizard`, placed in `features/events/` beside the existing `useEventLive`
  hook. `hooks.ts` stays TanStack Query data hooks only, as §3 requires.
- `resolver.fixtures.ts` is excluded from the library build by a new `**/*.fixtures.ts` entry applied
  to every project tsconfig that already excluded `*.test.ts` (20 files), and to the type-aware lint
  pass. The convention is recorded in `AGENTS.md` §12 so a fixture file cannot silently ship in a
  build. Verified: `dist/server-fns/src/events/` contains no fixtures output.
- Behavior unchanged: server-fns holds the same 70 tests (12 files before, 15 after) and the public
  app the same 14. Repository-wide format, sync, typecheck, lint, test, and build gates pass, with
  only the four unrelated pre-existing warnings and no errors.
- A 301-line probe file fails lint with `File has too many lines (301). Maximum allowed is 300`; a
  300-line file passes.

## 5. Required test matrix

| Area                     | Level                    | Must prove                                                                                               |
| ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Notification lifecycle   | Miniflare + D1           | Every row reaches a terminal state; no unroutable row is selectable twice; retry and fallback both occur |
| Notification concurrency | Miniflare + D1           | Two overlapping sweeps dispatch each row exactly once                                                    |
| Notification content     | Unit + i18n parity       | All three templates render in `ar`, `fr`, and `en`; no key missing from any locale                       |
| RSVP capacity            | Miniflare + D1           | A rejected full-capacity attempt writes nothing; counter and attendee rows always agree                  |
| RSVP concurrency         | Miniflare + D1           | The final seat yields exactly one attendee; a duplicate returns the typed error                          |
| Endpoint protection      | Miniflare integration    | Every state-changing server function rejects unauthorized callers and enforces its rate limit            |
| Map endpoints            | Miniflare integration    | Rate limits engage; a limited search surfaces a localized recoverable state                              |
| Response headers         | Integration + Playwright | Headers present on document and server-function responses; zero CSP violations in the host wizard        |
| Boundary enforcement     | Lint fixture             | A violation inside `features/<domain>/components/` fails lint                                            |
| Coverage                 | CI gate                  | `libs/domain` and `libs/server-fns` measured and thresholded                                             |

Cloudflare bindings remain real Miniflare bindings throughout. Provider-interface fakes are permitted
only for external services, per `AGENTS.md` §11.5.

## 6. Delivery boundaries

The audit confirmed two further defects that this plan deliberately does **not** own, because an
existing plan already does and duplicating ownership would fragment it:

- **F-08 — one-minute D1 polling with an unbound queue.** `apps/worker-jobs/wrangler.jsonc` runs
  `*/1 * * * *` against D1 in all three environments, while the queue consumer is fully written and
  dispatches on `RESOURCES.queues.notifications` with no queue binding or consumer declared anywhere —
  so that path is unreachable in every deployed environment. This is the largest gap between the
  documented architecture and what runs. It is owned by **P0-018** and sequenced at **CO-02** in the
  [Community Operations Plan](./community-operations-implementation-plan.md). AR-02 and AR-03 are
  interim integrity fixes for the sweep that CO-02 replaces; if CO-02 lands first, AR-03 is superseded
  and AR-02 reduces to the terminal-state guarantee, which the queue path needs regardless.
- **F-13 — the critical-flow release gate does not exist.** The Playwright suite is one file,
  `apps/ui/e2e/company-footer.spec.ts`, covering five footer links. The signup → create event → RSVP
  flow named in `AGENTS.md` §12 has no end-to-end coverage. This is owned by **P1-021** and delivered
  at **EC-10**.

This plan also does not: change the locked stack; add a dependency, Cloudflare service, or external
integration; alter the community-only release boundary; implement paid events; expand the sponsor or
admin applications; or move E2E into CI, which remains excluded by current project decision.

## 7. Risks and execution-time approvals

- **AR-02 and AR-03 require schema changes** for the new status values. Both need reviewed,
  forward-only migrations, and both must be checked against deployed row counts before the migration
  is generated, in the manner EC-03 established.
- **AR-02 may reveal existing stuck rows** in staging or production. Read-only counts of `pending`
  rows older than their `send_at` must be taken before remediation, and any backfill of existing rows
  requires explicit approval, as it changes deployed member-facing state.
- **AR-08 can break the application if enforced before it is measured.** The report-only phase is not
  optional. A CSP that blocks Turnstile or Mapbox silently disables event creation.
- **AR-09 layer tags may surface a wide set of existing boundary violations.** If the surfaced set is
  large, the remediation is staged rather than widened, and the interim state is recorded rather than
  suppressed with rule exceptions.
- **AR-05's policy sizing depends on real wizard behavior.** A limit set too tight breaks venue search
  for legitimate hosts; the policy must be derived from an observed session, not guessed.
- **AR-01 is the only ticket with no execution-time risk** and gates everything else.

## 8. Definition of done

- [ ] All seven verification gates pass, including `npm audit --audit-level=high`.
- [ ] No scheduled notification can remain selectable indefinitely, and the documented retry and
      email fallback are exercised by tests rather than described by comments.
- [ ] A rejected full-capacity RSVP writes nothing, and no untyped error crosses a server-function
      boundary.
- [ ] Every state-changing server function declares a permission and enforces a rate limit; anonymous
      and metered endpoints carry the additional protection their exposure requires.
- [ ] Notification content is localized in `ar`, `fr`, and `en` from `libs/i18n`, with parity enforced
      by test.
- [ ] Responses carry the required security headers and an enforced CSP with zero violations in the
      audited flows.
- [ ] The boundary lint rule covers every component directory, and coverage gates run on `libs/domain`
      and `libs/server-fns` in CI.
- [ ] Every finding in section 2 is either closed by an `AR-*` ticket or explicitly assigned to its
      owning plan in section 6.
- [ ] The implementation plan's status table is updated from the evidence this plan produces, and no
      `Partial` or `Blocked` item is promoted without it.
