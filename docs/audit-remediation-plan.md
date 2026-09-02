# Audit Remediation Plan

| Field          | Value                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | Active; AR-01 through AR-07 and AR-09 through AR-13 complete; AR-08 partial                                                                                                                          |
| Last reviewed  | 2026-09-02                                                                                                                                                                                           |
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

AR-01 was a prerequisite for every other ticket in the repository, not only for this plan:
continuous integration was red at the audited commit, so no pull request could pass verification. It
is closed as of 2026-09-02 and all seven gates now pass; the section 2 baseline is left as it was
recorded at `1167e0d`.

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
| F-17 | High     | New    | `features/push/client.ts` imports `server-fns` at runtime, past the `api.ts` layer     | AR-12  |
| F-18 | High     | New    | The notification sweep casts row payloads instead of validating them with Zod          | AR-13  |
| F-19 | Medium   | New    | Root files were linted by nothing — resolved 2026-09-02                                | AR-11  |

F-17 through F-19 were found by a second conformance pass on 2026-09-02, after AR-11 and AR-01
closed. They are recorded here rather than folded into the 2026-09-01 baseline above, which stays as
it was taken at `1167e0d`.

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
   to a billed external API carries identity-scoped rate limiting at minimum. The active shared
   Free-plan WAF is a blunt edge layer and does not replace endpoint-specific application limits.
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
production consequences; AR-02, AR-03 and AR-04 are complete. Then AR-09, which restores the mechanisms that would
have caught several of the others. AR-12 belongs with AR-09, which fixes the same rule. AR-13 sequences after AR-02, which
rewrites the same sweep. AR-03, AR-06, AR-07, AR-08, and AR-10 follow in any order the schedule
allows. AR-01 and AR-11 are complete.

### AR-01 — Restore the dependency-audit gate

**Parent:** P0-020
**Requirements:** NFR-4, NFR-12
**Status:** Complete — 2026-09-02

Closes F-01.

Work:

- Add `browserslist` to the root `package.json` `overrides` block at the first version clearing
  GHSA-c83g-rgw3-j3cx and GHSA-73wf-gq98-2v4g, alongside the existing transitive pins.
- Refresh `package-lock.json` and confirm the override reaches both dependents, `@nx/js` through
  `@babel/helper-compilation-targets` and `@serwist/vite` through `@serwist/utils`.
- Record that the package is a build-time transitive with no Worker runtime exposure, so the change
  carries no runtime risk.

Completion evidence:

- `"browserslist": "^4.28.7"` added to `overrides`. Both advisories are fixed in `4.28.7`, the first
  version above the `<=4.28.6` vulnerable range; the lockfile resolves `4.28.8`.
- `npm ls browserslist --all` shows `4.28.8` on both paths: `@nx/js` through
  `@babel/helper-compilation-targets` and `core-js-compat`, and `@serwist/vite` through
  `@serwist/utils`, where it is reported as `overridden`.
- The lockfile change is confined to `browserslist` and the packages it owns: `caniuse-lite`,
  `electron-to-chromium`, `node-releases`, `baseline-browser-mapping`, and `update-browserslist-db`.
  No application or Worker-runtime dependency moved.
- `browserslist` is a build-time transitive of the Babel and Serwist toolchains. Nothing under
  `apps/*/src` or `libs/*/src` imports it and it is not bundled into any Worker, so the bump carries
  no runtime risk.
- `npm ci` from the refreshed lockfile installs `4.28.8` and reports `found 0 vulnerabilities`.
- `npm audit --audit-level=high` exits 0.
- Repository-wide format, sync, typecheck, lint, test, and build gates pass without E2E: 16 projects,
  no errors. Continuous integration is green at head for the first time since the audit.

### AR-02 — Guarantee terminal state and a reachable fallback for scheduled notifications

**Parent:** P0-018, P1-009
**Requirements:** FR-N1; NFR-3, NFR-7
**Status:** Complete — 2026-09-02

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

Completion evidence:

Both defects were reproduced on the pre-fix code before anything was changed, by checking the two
original files back into the tree and running a probe against them:

```text
LEGACY_F02>>> after 5 sweeps: status=pending attempts=0
LEGACY_F03>>> rows=1 statuses=sms:failed:a1
```

The push row never advanced, and the documented email fallback was never created. The same probe on
the fixed code:

```text
FIXED_F02>>> after 5 sweeps: status=failed attempts=1
FIXED_F03>>> rows=2 statuses=sms:failed:a1,email:sent:a0
```

- Per-channel dispatch moved to `notification-dispatch.ts`. A channel with no configured provider is
  **absent** from the dispatcher map rather than mapped to a no-op, and the sweep resolves an
  unroutable row terminally — which is what keeps it out of every later selection window.
- Every path now ends in `markNotificationSent` or `markNotificationFailed`. A provider that throws
  is converted to a retryable failure instead of aborting the sweep and leaving the rest of the
  window `pending`.
- `markNotificationFailed` decides retry versus terminal **inside** the statement
  (`status = CASE WHEN permanent OR attempts + 1 >= max THEN 'failed' ELSE 'pending' END`), defers
  `send_at` by a backoff, and creates the fallback row in the same batch at the moment the row goes
  terminal. That is what makes the documented fallback reachable at all.
- Exactly-one-fallback is now a **database invariant**: migration `0013` adds `fallback_of` with a
  UNIQUE index, so a replayed failure path cannot spawn a second fallback for the same parent. The
  deterministic `${id}_fb` identifier is gone. SQLite treats NULLs as distinct in a unique index, so
  ordinary rows are unaffected — asserted by test.
- `listPendingNotifications` orders by `send_at, id`.
- Cancellation writes the new terminal `cancelled` state, distinguishable from a delivery failure.
- A user with no registered device token is now a permanent push failure rather than a silent
  success: nothing was delivered, and recording `sent` both misreported delivery and skipped any
  fallback the row carried.

Verification — 22 new tests against real D1 under Miniflare:

- A push row with no configured provider reaches a terminal state in one sweep.
- A full window of 100 unroutable rows is cleared in one sweep and the next newly due SMS row is
  reached on the following one.
- A transient failure stays `pending` with `attempts` incremented and `send_at` deferred; it is not
  re-selected until the backoff elapses, and fails terminally once the budget is spent.
- The email fallback is created exactly once, links back through `fallback_of`, and is delivered on
  the next sweep. A replayed failure path creates no second fallback.
- A cancelled row is `cancelled`, not `failed`, and is not re-selected.
- Regression: across push, SMS and email in one sweep, no selected row is left `pending` with
  unchanged `attempts`.
- Two overlapping sweeps advance the row once and create one fallback.
- Migration `0013` is tested for data preservation on the prior schema, and the UNIQUE index is
  proven to reject a second fallback for the same parent.
- `migrations.test.ts` asserted `TEST_MIGRATIONS.at(-1)` was `0012`, so adding `0013` broke it. It
  now locates migrations by name, and a later migration cannot silently retarget an existing test.

Limits of the evidence, deliberately left to AR-03: there is still no claim or lease, so two
overlapping sweeps both select the same rows and a row can be dispatched twice. Delivery is
at-least-once. The `status = 'pending'` guard means only one sweep advances the row and only one
fallback is created, but it does not prevent a duplicate send. A D1 write failure also leaves a row
untouched — the store being unavailable is the one case where state cannot be recorded, and the next
sweep retries it. Both bounds are recorded in the sweep's own documentation.

### AR-03 — Claim scheduled notifications before dispatch

**Parent:** P0-018, P1-009
**Requirements:** FR-N1; NFR-3, NFR-7
**Status:** Complete — 2026-09-02

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

Completion evidence:

The defect was reproduced on the pre-fix code before anything changed, by checking the three
original files back into the tree and counting provider calls rather than row states:

```text
LEGACY_F07>>> rows=6 provider sends=12
FIXED_F07>>>  rows=6 provider sends=6
```

Two overlapping sweeps sent every notification twice. They now send each once.

- `claimDueNotifications` is a single
  `UPDATE ... WHERE id IN (SELECT ... ORDER BY send_at, id LIMIT n) RETURNING *`. It moves the
  window to the new `processing` status and hands back exactly the rows this caller won, so
  overlapping sweeps operate on disjoint sets — the loser's `status = 'pending'` predicate no longer
  matches. Claim and read are one atomic statement, so there is no window between them.
- `markNotificationSent` and `markNotificationFailed` are now guarded on `status = 'processing'` and
  clear `claimed_at`, so only the sweep holding the claim can resolve a row. A stale invocation
  returning late cannot overwrite the outcome of the sweep that reclaimed it.
- Migration `0014` adds `claimed_at` and a partial index on it for `status = 'processing'`.
- Stale claims are released through the **ordinary failure path** rather than a bespoke one, so a
  reclaim spends one attempt from the existing budget and either defers the row or retires it with
  its fallback. That is what stops a repeatedly dying invocation from reclaiming the same row
  forever — a bespoke "set it back to pending" reclaim would have looped without bound.
- The claim timeout is 900 seconds, chosen against a hundred serial provider calls at their timeout
  rather than their typical latency. A timeout shorter than the slowest plausible sweep would let a
  later sweep reclaim rows still in flight and dispatch them again, turning the fix into the bug.
- `libs/db/src/notifications.ts` reached 358 lines and was split by responsibility into
  `notification-claim.ts` (claim and reclaim), `notification-failure.ts` (resolution, budget,
  fallback) and `notifications.ts` (enqueue, reads, cancellation).

Verification — 13 new tests against real D1:

- Two overlapping sweeps over six due rows produce exactly six provider sends.
- A claim moves rows to `processing`, stamps `claimed_at`, hides them from the pending read, and
  leaves nothing for a second claim to take.
- `markNotificationSent` on a row the caller does not hold is a no-op.
- A fresh claim is left alone; one past the timeout returns to `pending` with an attempt spent,
  `claimed_at` cleared, a `claim_expired` reason and a deferred `send_at`, and is delivered later.
- Reclaims consume the attempt budget, so a repeatedly dying run retires the row, creating its
  fallback exactly once.
- `sent + retrying + failed + contended` equals `selected + reclaimed` on every run, including when
  two sweeps race the same stale claim.
- Migration `0014` is tested for data preservation and for the partial index.

Follow-up, same day — the remaining duplicate window. AR-03 as first delivered still resent a row
whose provider call may already have been accepted, once the claim expired. Reproduced on that code
and then closed:

```text
LEGACY_DELIVERY>>> the first send already happened before the crash; resends=1
FIXED_DELIVERY>>>  the first send already happened before the crash; resends=0
```

- Migration `0015` adds `dispatch_started_at`. It is written immediately before the provider call
  and cleared by every resolution, so it is set for exactly the window in which the outcome is
  unknowable. A reclaimed row now says which of two things happened: unset means the sweep died
  before reaching a provider and retrying is free; set means the message may already be on its way.
- An unconfirmed row is resent only on a channel that can suppress the duplicate. Push can, and is
  resent. SMS and email cannot, so the row is retired with a `dispatch_unconfirmed` reason and its
  fallback, if it has one, carries the delivery — a second SMS on someone's phone is a worse outcome
  than a reminder they most likely already received.
- `CHANNEL_SUPPRESSES_DUPLICATES` records that capability explicitly rather than leaving it implied.
  Push is suppressed twice over: the Web Push `Topic` header replaces an undelivered copy in
  transit, and the service worker now tags the notification with the sending row's key so a copy
  that does arrive replaces the one on screen. That tag was previously the constant
  `founders-coffee-push`, which did the opposite of what it looked like — distinct reminders
  overwrote each other while duplicates still stacked.
- Email carries a stable `Message-ID` derived from the row id. Receiving systems commonly but not
  reliably collapse a repeat on it, so it is recorded as best effort and **not** as suppression.

The guarantee is now exactly-once on push, at-most-once on SMS and email after an unconfirmed
attempt, and at-least-once otherwise. Exactly-once across all three is not reachable: Twilio's
Messages resource offers no idempotency key, so no amount of local bookkeeping can make a second
send invisible. What is closed is every path that duplicated _silently_.

Note: AR-03 is superseded if the queue migration under P0-018 lands first. See section 6.

### AR-04 — Make RSVP capacity atomic and its duplicate error typed

**Parent:** P1-008
**Requirements:** FR-E3, FR-E4; NFR-4, NFR-10
**Status:** Complete — 2026-09-02

Closes F-04 and F-05. Both lived in the same twenty lines.

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

Completion evidence:

- The insert now selects its row _from_ `events` under the capacity predicate
  (`INSERT INTO event_rsvps (...) SELECT ... FROM events WHERE id = ? AND (capacity = 0 OR rsvps <
capacity)`), so it produces one row when a seat is free and none when it is not. It is ordered
  before the counter update on purpose: it must read `rsvps` before the counter moves, or the final
  seat would increment the counter while inserting no attendee. Both statements carry the same
  predicate in one batch, so they see one snapshot and either both apply or neither does.
- `already_rsvpd` is now derived from the `UNIQUE(event_id, user_id)` violation. The classifier walks
  the `cause` chain, because Drizzle replaces `message` with the failed SQL on the non-batch path and
  keeps the driver error as the cause; a Drizzle version that started doing that for batches would
  otherwise have turned a duplicate back into an untyped throw. Both shapes are covered by test.
- The unreachable `error.message === 'event_full'` comparison is deleted, and the repository doc
  comments now describe what the code does.
- `cancelRsvp` was reviewed as the ticket required, and its reasoning did **not** hold: the claim
  that "D1 batch can't conditionally skip a statement" is wrong, since a `WHERE` clause does exactly
  that. It is now one batch — the guarded decrement ordered before the delete so it reads
  `event_rsvps` while the row still exists — closing the window where a crash between the two
  statements dropped a row without decrementing.
- `RSVP_INSERT_COLUMNS` pins the column list Drizzle generates from the schema. A column added to
  `event_rsvps` would widen that list and break the insert at runtime only; the contract test turns
  that into a failing unit test instead.

Verification — 26 new tests, all against real D1 under Miniflare:

- At exactly full capacity the attempt writes nothing: no attendee row, counter unchanged.
- The final seat is accepted and the next attempt rejected, with the counter and rows still in step.
- Unlimited capacity, expressed as `0`, continues to accept.
- A duplicate returns `already_rsvpd`, sequentially and concurrently, never an untyped throw. A
  non-duplicate driver error (an FK violation) still propagates.
- Cancelling frees the seat, a double cancel decrements once, and the counter is never driven below
  zero.
- Resolver-level tests assert the typed `AppError` codes reach the throw boundary and that a
  rejected attempt enqueues no notifications.
- An invariant test asserts `counter === attendees` after each of 120 randomized rsvp/cancel
  operations, and after ten rounds of five concurrent operations.
- The invariant test was run against the pre-fix implementation and **fails** there, so it
  discriminates rather than merely passing. A separate probe reproduced F-04 exactly on the old
  code: at capacity the counter stayed at 1 while the attendee rows reached 2.

Limits of the evidence: Miniflare serializes D1 access, so the concurrency tests prove the predicate
and batch-atomicity logic rather than true multi-isolate parallelism. The production guarantee rests
on D1's documented batch-as-transaction semantics and SQLite's single-writer serialization, which is
the mechanism §11 mandates.

### AR-05 — Rate-limit the map server functions

**Parent:** P1-018
**Requirements:** NFR-4
**Status:** Complete — 2026-09-02

Closes F-06.

Current behavior: `libs/server-fns/src/maps/rpc.ts:18–33` defines `getHostMapContext`,
`searchEventVenues`, and `reverseEventVenue` with a validator and nothing else — no session, no
permission, no rate-limit middleware, no Turnstile. Each forwards to the Mapbox Geocoding API, which
bills per request. Any caller reaching `/_serverFn/` can drive that bill. The active shared WAF caps
gross IP volume across the server-function surface, but it cannot distinguish these paid provider
calls from other functions. These endpoints therefore require their own application limit before
release.

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
**Status:** Complete — 2026-09-02

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

Completion evidence:

- The RBAC model gains `profile: ['update']` and `push: ['manage']`, granted to every authenticated
  role because both are self-service on the caller's own account. `setHomeLocation`,
  `registerPushTokenFn` and `removePushTokenFn` now declare those permissions and carry
  identity-scoped limits: 10 home-location changes and 20 push-token writes per ten minutes, sized
  for actions that happen at onboarding, install and logout rather than in a loop.
- `joinWaitlist` carries Turnstile. The middleware is generalized into `requireTurnstile(action)`
  and its response is pinned to `join_waitlist`, so one minted on the waitlist form cannot be
  replayed against event creation. The `EVENT_CREATE_WAF_CONFIGURED` gate stays on event creation
  only — applying it everywhere would take unrelated endpoints down until that one account-side rule
  is configured.
- Adding the server-side requirement alone would have broken the waitlist: the form sent no token
  and every gate still passed, because the component tests mock the API layer. The widget is wired
  into `WaitlistForm` through the existing `usePublicAuthConfig` hook, submission is blocked until a
  response is obtained, and a failed submission reissues the challenge. Three component tests cover
  blocked-without-token, submitted-with-token, and the development bypass.
- `JoinWaitlistRequest` is now a distinct wire type. The resolver's `JoinWaitlistInput` was doing
  double duty as the request type, which is why adding one wire-only field became a type error at
  every call site.

### Endpoint audit — closes the P1-018 audit rather than sampling it

All 27 server functions were enumerated with their middleware chains. The state-changing surface is
now complete:

| Endpoint              | Method | Protection                                         |
| --------------------- | ------ | -------------------------------------------------- |
| `createEvent`         | POST   | `event:create` + rate limit + Turnstile + WAF gate |
| `createRsvp`          | POST   | `rsvp:create` + rate limit                         |
| `cancelRsvp`          | POST   | `rsvp:update` + rate limit                         |
| `setHomeLocation`     | POST   | `profile:update` + rate limit                      |
| `registerPushTokenFn` | POST   | `push:manage` + rate limit                         |
| `removePushTokenFn`   | POST   | `push:manage` + rate limit                         |
| `joinWaitlist`        | POST   | Turnstile + rate limit (anonymous by design)       |

Two results recorded rather than fixed silently:

- **Every mutation except `createEvent` was served over `GET`.** `createServerFn` defaults to
  `method: 'GET'` when none is given, so `createRsvp`, `cancelRsvp`, `setHomeLocation`, both push
  writes and `joinWaitlist` all mutated state on a safe method. The CSRF middleware accepts
  `Sec-Fetch-Site: none` so a direct navigation would have passed it, and any intermediary that
  replays a GET could have repeated the write. All six now declare `method: 'POST'`. This was found
  by the audit rather than listed in the ticket.
- **The twenty remaining functions are reads and stay anonymous by design** — geography, markets,
  public event and profile reads, and the two public client configs. `getMyProfile` is
  session-enforced in its handler. A literal reading of §7 asks every server function to declare a
  permission; applying RBAC to a public city listing would be noise, so the deviation is recorded
  here rather than papered over.
- **RSVP still has no Turnstile**, which §10 requires alongside signup, login and event creation.
  Out of AR-06's scope, which named the authorization and waitlist gaps; recorded so the §10 gap is
  not lost.

Verification — 14 new tests:

- Every authenticated role, including the dormant `sponsor_contact`, may update its own profile and
  manage its own push registrations; `sponsor_contact` still cannot create an event or an RSVP, so
  the new grants did not widen anything else.
- Turnstile actions are distinct per flow.
- The waitlist provider fails closed outside development with no secret and on an explicit
  `TURNSTILE_DISABLED=true`, and builds a real provider when configured.
- The form will not submit before verification, submits the token once obtained, and submits without
  one only when the deployment bypasses Turnstile.

Not testable here, and stated rather than implied: `createServerFn` cannot be imported in the
Miniflare pool, so the middleware chains themselves are asserted by the audit table above and by
typecheck, not by an integration test that exercises a rejected role over the wire.

### AR-07 — Localize notification content

**Parent:** P1-009
**Requirements:** FR-N3; NFR-9
**Status:** Complete — 2026-09-02

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

Completion evidence:

- Sixteen `ntf_*` keys carry the three template families across `ar`, `fr` and `en`: SMS body, email
  subject/html/text, and push title/body. `templates.ts` renders them; the English literals are gone
  from `producer.ts`.
- Locale resolution follows the documented order — member preference, then market default, then
  `ar`. It previously fell back to `en` at the RSVP call site, which inverted that order and wrote to
  an Arabic-default market's members in English.
- The base URL comes from `APP_URL`, so each environment links to itself. It was hardcoded to
  production in four places, which meant a staging reminder sent a member to the live site.
- HTML escaping is preserved and now applied to every interpolated value including the URL, because
  Paraglide substitutes placeholders verbatim. Plain-text and SMS variants are deliberately left
  unescaped.

Found by this work rather than listed in the ticket:

- **Dates rendered in the Worker's UTC, not the market's zone**, because `toLocaleDateString` was
  called with no `timeZone`. §6 requires storing UTC and rendering in the market zone. For an event
  at `2099-01-15T23:30Z` the two disagree on the day: `Thursday, Jan 15, 11:30 PM` in UTC against
  `Friday, Jan 16, 12:30 AM` in `Africa/Algiers`. Every evening event in Algiers was being announced
  on the wrong day. `resolveNotificationContext` now returns the market time zone alongside the
  locale from the single market read the locale fallback already needed.
- **The public barrel re-exported the producer**, so introducing a `cloudflare:workers` import into
  its module graph broke the client build. Nothing outside `libs/server-fns/src` imported any of the
  four symbols, so the re-export is removed rather than worked around.

Verification — 78 new tests:

- Every template renders in all three locales with full interpolation and no unresolved placeholder;
  Arabic output is in Arabic script and French is not silently English.
- A hostile title is escaped in the HTML variant and left intact in the text and SMS variants.
- An i18n parity test fails if any `ntf_*` key is missing from a locale, if placeholder sets drift
  between locales, or if the three files stop having identical keys.
- Locale resolution is proven for preference, market default, unknown market, and an unsupported
  stored preference — the last two land on `ar`, never `en`.
- End to end against real D1: the enqueued payload for an Arabic member is in Arabic, links to the
  configured environment rather than production, names `Friday` rather than `Thursday`, and contains
  no unresolved placeholder.

Deviation, recorded rather than silent: the ticket asks for rendering "at send time". Rendering stays
at enqueue time, where it already was, because moving it means the sweep must parse the payload it
currently casts — which is AR-13's work on the same code. The consequence is that a member who
changes locale after RSVPing keeps the original language on already-scheduled reminders. Worth
revisiting when AR-13 lands.

### AR-08 — Add secure response headers and a strict CSP

**Parent:** P1-018
**Requirements:** NFR-4
**Status:** Partial — headers enforced 2026-09-02; CSP report-only pending measurement

Closes F-09 for the header set. The CSP is shipped but not yet enforcing; see the boundary at the
end of this ticket.

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

Completion evidence:

- `libs/core/src/security-headers.ts` holds the shared policy, applied at the Worker entry of both
  `apps/ui` and `apps/admin`. It sits at the entry rather than inside the router so it covers
  documents, assets, server-function responses, the auth handler and error responses alike — a
  header that only lands on some responses is the one an attacker uses. All seven return paths in
  the public Worker are wrapped.
- Enforced immediately, because none of them can change how a page renders:
  `Strict-Transport-Security` (one year, `includeSubDomains`), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a
  `Permissions-Policy` that denies every sensor and payment capability and allows geolocation only
  to the app itself.
- The CSP enumerates exactly the three approved integrations, each justified against the built
  bundle: Turnstile needs `script-src` and `frame-src`; Mapbox needs `api`, `events` and `*.tiles`
  hosts plus `blob:` in `worker-src` for its renderer and `blob:`/`data:` in `img-src` for tiles;
  Firebase needs two `connect-src` hosts and no script source because the SDK is bundled.
  `base-uri`, `object-src` and `frame-ancestors` are `'none'`; `form-action` and `default-src` are
  `'self'`.
- Audited rather than assumed: every `https://` origin reachable from the built client bundle was
  extracted and checked against the policy. All five runtime origins are covered, and the policy
  admits nothing beyond them — a test asserts that set cannot grow silently.
- A `/csp-report` endpoint on the public Worker feeds violations to the structured logger, so
  report-only mode actually reports somewhere. Reporting to nowhere would have made the required
  measurement impossible.

Verification — 11 unit tests covering the header set, report-only versus enforced, the locked-down
directives, the absence of `'unsafe-inline'` and `'unsafe-eval'` in `script-src`, the approved-origin
allowlist, report-endpoint wiring, source merging, and that the wrapper preserves body, status,
statusText and pre-existing headers on document, JSON and error responses.

Boundary — what is deliberately not done, and why:

- **The CSP ships report-only.** `CSP_ENFORCED=true` flips it per environment. The plan's own risk
  section says the report-only phase is not optional, and the ticket requires recording observed
  violations before enforcing.
- **Script nonces are not wired.** TanStack emits three inline scripts and its nonce option lives at
  `router.options.ssr.nonce`, inside a `getRouter()` factory that takes no request and runs on both
  client and server. Threading a per-request value through it is real work that cannot be verified
  without a browser. `script-src` therefore carries neither `'unsafe-inline'` nor a nonce, which is
  what makes the report tell us precisely which inline scripts need one.
- **`style-src` keeps `'unsafe-inline'`**, recorded rather than hidden: React writes inline `style`
  attributes and streaming SSR inserts a style element before hydration. Removing it needs a style
  nonce on the same path as the script nonce.
- **The Playwright pass across `ar`, `fr` and `en` has not been run.** It needs a browser driven
  against a deployed environment. Enforcing is gated on it, and on the reports the new endpoint
  collects.

### AR-09 — Repair the two enforcement mechanisms

**Parent:** P0-001, P0-021
**Requirements:** NFR-10, NFR-11
**Status:** Complete — 2026-09-02

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

Completion evidence — F-11:

- The local rule's path test was widened under AR-12 and now carries a `RuleTester` fixture suite
  proving each case rather than a manual probe: a `features/<domain>/components/` file importing
  `server-fns` fails, the same file importing `domain` fails under §16, `features/<domain>/api.ts`
  importing `server-fns` passes as §3 designates, feature logic importing `domain` passes as §6
  requires, and a type-only `db` import passes anywhere.
- Those tests live at the repository root beside the rules they cover, so `workspace-root` gained a
  `test` target. `nx run-many -t test` — the command CI already runs — now covers them; nothing ran
  them before.
- The application projects carry layer tags, so the Nx constraints engage where they asserted
  nothing:

| Project                         | Tag            | May depend on                    |
| ------------------------------- | -------------- | -------------------------------- |
| `apps/ui`, `admin`, `dashboard` | `layer:app-ui` | ui, shared, server, domain, data |
| `apps/worker-jobs`              | `layer:server` | server, domain, data, shared     |

- `layer:app-ui` rather than `layer:ui` is deliberate. A UI application genuinely reaches the server
  layer — `features/<domain>/api.ts` and route loaders call server functions, which is the designed
  path — while `libs/ui` must never do so. One tag cannot be both, because Nx combines constraints
  rather than overriding them, so reusing `layer:ui` would have forced a choice between unlocking
  the design system and failing 87 legitimate imports. Splitting them keeps `libs/ui` strict and
  turns an application's reach into an explicit list instead of the absence of a tag. The file-level
  half — that only `api.ts` may hold those imports — stays with
  `local/no-server-fns-in-components`.
- `apps/worker-jobs` is tagged `layer:server` because that is what it is: a queue and cron consumer
  with no UI. It can no longer import `libs/ui` or any application code.
- Both constraints were probed rather than assumed. `worker-jobs` importing `libs/ui` and `libs/ui`
  importing `server-fns` each fail lint with the expected message; both probes were removed.
- Repository-wide gates pass with the tags applied: 17 projects, 588 tests, zero boundary
  violations.

Completion evidence — F-12:

`@vitest/coverage-istanbul` is added as a dev dependency, approved under §1.8 rather than installed
silently. `@vitest/coverage-v8` was tried first and removed: it imports `node:inspector/promises`,
which the Workers runtime does not provide, so it cannot run in the `@cloudflare/vitest-pool-workers`
pool that `libs/server-fns` uses for every test. Istanbul instruments at transform time and works in
both pools, so one provider serves both libraries.

Thresholds are the measured baseline, floored — not an aspiration:

| Library           | Statements | Branches | Functions | Lines  |
| ----------------- | ---------- | -------- | --------- | ------ |
| `libs/domain`     | 59.80%     | 40.00%   | 40.00%    | 63.15% |
| `libs/server-fns` | 69.90%     | 67.28%   | 64.53%    | 71.00% |

Set at the floor of each measurement so the gate cannot pass a regression and can only be raised
deliberately. An invented number would have failed on day one or asserted nothing — and these two
libraries are exactly where F-02, F-03 and F-05 hid, so the number had to come from measurement.

- `all: true` is essential and was nearly missed. The default counts only files a test already
  touches, which reported `libs/domain` at **100%** while its real figure is **59.8%** — the metric
  would have been blind to precisely the untested files that motivated this ticket.
- The versioned geo datasets are excluded from `libs/domain`. They are data rather than logic,
  already exempt from the line cap under §11, and 36,000 lines of them would swamp the measurement.
- Coverage runs as part of the `test` target rather than a separate one, so the gate fires locally
  and in CI wherever `nx run-many -t test` runs. Measured overhead is within run-to-run noise.
- Probed: raising the `libs/domain` statement threshold to 95 makes `nx run domain:test` fail with
  `ERROR: Coverage for statements (59.8%) does not meet global threshold (95%)`. Reverted.
- `.gitignore` carried `/coverage`, which is root-anchored and would have let `libs/*/coverage`
  be committed. Widened to `**/coverage`.

Installing the provider refreshed the lockfile and surfaced an unrelated high-severity advisory:
the existing `fast-uri` override pinned `^4.1.2`, which is inside the newly published vulnerable
range `4.0.0 - 4.1.2`. Bumped to `^4.1.3`, resolving 4.1.4; `npm audit --audit-level=high` is back to
exit 0. The AR-01 gate would otherwise have gone red on the next push.

### AR-10 — Correctness and hygiene cleanup

**Parent:** P1-018, P1-019
**Requirements:** NFR-4, NFR-7, NFR-10
**Status:** Complete — 2026-09-02

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

Completion evidence — all six items:

- **Location hint.** `DURABLE_OBJECT_LOCATION_HINT` (`weur`) lives in `libs/infra` and is applied at
  both call sites, `rateLimit()` and the live-event room in `apps/ui/src/server.ts`. Western Europe
  is the closest Cloudflare placement region to the Maghreb user base; `afr` is accepted by the API
  but has no Durable Object capacity today. Note the hint belongs on `namespace.get()`, not on
  `idFromName` — a test asserts a hinted and an unhinted stub address the same bucket, so adding the
  hint cannot silently split existing buckets in two.
- **`SEVEN_DAYS_MS` renamed** to `SEVENTY_TWO_HOURS_MS`. The value was always 72 hours.
- **Eviction path.** One object exists per identity-and-action pair, so the population grows with
  every distinct caller and never shrinks. `consume` now arms an alarm 24 hours out and `alarm()`
  deletes an idle bucket, or re-arms if the bucket was used since. Deleting is safe precisely because
  the bucket is idle: a caller returning later would have refilled to full anyway, so an evicted
  bucket and a fresh one grant the same allowance.
- **Version pinning.** The ten `"latest"` specifiers across `apps/ui`, `apps/admin`,
  `apps/dashboard` and `libs/server-fns` are replaced with pinned ranges at the versions already in
  the lockfile. Any `npm install` could previously have moved the framework silently.
- **`apps/api` removed** from `AGENTS.md` §2 and §16. The application is gone; a rule forbidding work
  on something that no longer exists misleads the next reader. The general NestJS ban in the
  forbidden-stack list stays.
- **Typed env.** `libs/infra` now declares `WorkerEnv`, which §3 already names it as the home for,
  and `libs/server-fns/src/env.ts` performs the single narrowing. The three untyped casts in
  `rate-limit.ts` and `config.ts` are gone. `WorkerEnv` is optional almost everywhere on purpose: a
  binding absent from one environment must be something the code checks for, not a build error. An
  absent `RATE_LIMITER` now fails closed rather than throwing on a property of `undefined`.

The coverage gate added in AR-09 immediately paid for itself: this ticket's new code dropped
`libs/server-fns` below all four thresholds on the first run.

```text
ERROR: Coverage for lines (69.63%) does not meet global threshold (70%)
ERROR: Coverage for functions (63.63%) does not meet global threshold (64%)
ERROR: Coverage for statements (68.53%) does not meet global threshold (69%)
ERROR: Coverage for branches (66.06%) does not meet global threshold (67%)
```

The thresholds were **not** lowered to accommodate it. Nine tests were added instead, covering the
eviction alarm through `runInDurableObject` — idle bucket deleted, active bucket re-armed, missing
bucket cleared, alarm armed on use — and the env accessor. `libs/server-fns` is back above every
threshold at 70.30 / 67.27 / 65.03 / 71.35. An untested eviction path would have been the same shape
of defect as F-02.

Verification: repository-wide format, sync, audit, typecheck, lint, test and build pass — 17
projects, 596 tests, zero errors.

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

Line counts are as at `e6a7faa`, after the comment policy of the same series stripped the narrative
comments the split had carried over.

| Original                                         | Lines | Now | Split into                                                                                                                          |
| ------------------------------------------------ | ----- | --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/ui/src/durable-objects/EventLiveDO.ts`     | 521   | 245 | `event-live/protocol.ts` (72), `event-live/session.ts` (78), `event-live/roster.ts` (99), `event-live/connections.ts` (54)          |
| `apps/ui/src/components/host/HostCreatePage.tsx` | 449   | 183 | `useHostCreateWizard.ts` (192), `HostWizardHeader` (55), `HostMapPanel` (78), `HostVenueStep` (56), `HostDetailsStep` (90)          |
| `libs/server-fns/src/events/resolver.test.ts`    | 479   | 141 | `resolver.fixtures.ts` (123), `resolver.boundary.test.ts` (56), `resolver.persistence.test.ts` (154), `resolver.reads.test.ts` (43) |
| `libs/server-fns/src/maps/mapbox-provider.ts`    | 336   | 178 | `mapbox-schemas.ts` (60), `mapbox-filters.ts` (117)                                                                                 |

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

Follow-up, 2026-09-02 — closes F-19. The cap did not bind the toolchain that enforces it.
`eslint.config.mjs` had itself grown to 326 lines and `vitest.workspace.ts` carried a narrative
comment, and neither failed CI: `nx run-many -t lint` runs `eslint .` per project, and no project
owns the repository root.

- The three local rules, the module-boundary contract, and the file globs moved out of
  `eslint.config.mjs` into `tools/eslint/`, leaving 91 lines of pure wiring. Rationale moved with
  the rule it explains rather than being deleted.
- A `workspace-root` project lints `eslint.config.mjs`, `vitest.workspace.ts`, and `tools/`, so
  `nx run-many -t lint` — the command CI already runs — now covers them. The root `package.json`
  declares `nx.includedScripts: []`, without which Nx infers every root npm script as a target and
  `workspace-root:typecheck` would recurse into `nx run-many -t typecheck`.
- Probe: appending 220 blank lines to `eslint.config.mjs` and a comment to `vitest.workspace.ts`
  makes `nx run-many -t lint` fail with `max-lines` and `local/no-comments`. Both were reverted.

### AR-12 — Close the `api.ts` boundary in `features/`

**Parent:** P0-021
**Requirements:** NFR-10, NFR-11
**Status:** Complete — 2026-09-02

Closes F-17, and the `features/` half of F-11.

Current behavior: `apps/ui/src/features/push/client.ts` imports `registerPushTokenFn` and
`removePushTokenFn` from `@founders-coffee/server-fns` as runtime values. §3 makes `api.ts` the only
module permitted to import `libs/server-fns`, and §4 routes every component call through
`hooks.ts`. The `local/no-server-fns-in-components` rule cannot see it: the rule returns early
unless the path matches `/src/(components|lib)/`, so all of `features/` — including
`features/<domain>/components/` — is unguarded. The violation is real, not theoretical; it is the
only one, and it exists because nothing was checking.

Work:

- Move the two server-function imports into `features/push/api.ts` and have `client.ts` call
  through it, keeping the Firebase messaging setup where it is.
- Widen the rule's path test to `/src/(components|lib|features)/`, keeping the type-only exemption
  so `import type` from `db`/`domain` continues to pass, and allowing `features/*/api.ts` — the one
  module §3 designates for it.
- Add a fixture pair under the rule's own tests: a `features/x/components/` file importing
  `server-fns` fails; `features/x/api.ts` importing the same passes.

Verification:

- `nx run-many -t lint` fails on a probe import in `features/<domain>/components/` and passes on the
  same import in `api.ts`.
- No runtime import of `server-fns`, `db`, or `domain` outside `api.ts` anywhere under `apps/*/src`.
- Push registration still works end to end against Miniflare.

### AR-13 — Validate notification payloads at the sweep boundary

**Parent:** P0-018
**Requirements:** FR-N1; NFR-4
**Status:** Complete — 2026-09-02

Closes F-18. Sequence after AR-02, which rewrites the same sweep's status lifecycle.

Current behavior: `apps/worker-jobs/src/jobs/notification-sweep.ts` reads each row's `payload` and
casts it per channel — `(payload as { phoneNumber: string }).phoneNumber`,
`(payload as { subject: string }).subject`, `payload as { pushTitle: string; pushBody: string }`.
A cast is not a check. A row written by an older schema, a partial write, or a future producer
reaches Twilio, Cloudflare Email, or FCM with `undefined` where a required field belongs, and the
resulting provider error is recorded as a delivery failure rather than the data defect it is. §7
and §10 both require Zod validation at every boundary where untrusted data enters, and a persisted
JSON blob crossing back into code is such a boundary.

Work:

- Define a discriminated union of per-channel payload schemas in `libs/domain` beside the
  notification status machine, inferred types replacing every cast.
- Parse the payload once per row at the top of the sweep. On a parse failure, mark the row
  terminally failed with a distinct `invalid_payload` reason and log it structurally — never
  dispatch it, and never leave it selectable.
- Have the producers validate with the same schema before insert, so the contract is enforced on
  both sides of the row.

Completion evidence:

- `libs/domain/src/notifications/schemas.ts` holds one schema per channel and
  `parseNotificationPayload(channel, payload)`, which returns a discriminated result. The payload
  carries no channel of its own — that lives on the row — so the union is discriminated at the parse
  site rather than by a field, which also keeps existing rows parseable.
- The sweep parses once per row before dispatching anything. A payload that does not parse is
  retired terminally with an `invalid_payload` reason naming every failing field, logged
  structurally, never dispatched and never selected again. `SweepReport` gained `invalidPayload`.
- All three casts are gone from `apps/worker-jobs`; dispatchers receive the parsed payload and
  narrow on its channel.
- The producer validates with the same schema before insert, so the contract holds on both sides of
  the row. A rejected payload throws, because at that point it is a bug in the producer rather than
  a user error.
- Unknown keys pass through rather than failing. The payload is a content envelope that has grown
  fields before and will again; the schemas assert what each channel needs, not what nothing else
  may carry.

Found by this work rather than listed in the ticket — the SMS-to-email fallback delivered an empty
message. AR-02 made that fallback reachable and it inherits the parent row's payload unchanged, but
the producer wrote email content only on email-channel rows:

```text
PRODUCER>>> channel=sms fallback=email keys=email,eventSlug,eventTitle,locale,marketCode,phoneNumber,smsBody,startsAt,venue
```

No `subject`, no `html`. The fallback row reached Cloudflare Email with both undefined. The SMS
schema now requires the email content and the producer writes it, which looks redundant on an SMS
row and is exactly what makes its fallback deliverable. A test drives the whole path: permanent SMS
failure, fallback created, fallback delivered, `invalidPayload` zero.

Verification — 20 new tests:

- A row missing a required field, and one with a wrong field type, are both retired terminally with
  the failing field named; neither is dispatched, and neither is selected on the next sweep.
- A valid row of each channel dispatches unchanged.
- The accounting identity still holds when a row is retired as invalid.
- The schema unit tests cover every channel, an unknown channel, a non-object payload, each missing
  or malformed field, unknown-key passthrough, and that an SMS payload validates as an email payload
  — which is precisely what the fallback relies on.
- `grep "payload as"` over `apps/worker-jobs/src` returns nothing.

The fixtures themselves had been writing payloads with no base fields at all, and every sweep test
passed on them. They now write valid payloads, which is the same defect this ticket exists to
prevent, one layer up.

`libs/domain` coverage rose from 59.80/40.00/40.00/63.15 to 65.54/45.45/44.44/68.75, and its
thresholds are ratcheted up to the new floor so the gain cannot silently erode.

One defect introduced by AR-09 and caught here: `server-fns:lint` failed intermittently inside
`nx run-many` while passing on its own. ESLint was linting the coverage report that the `test` task
writes concurrently, so files vanished mid-run —
`ENOENT: ... libs/server-fns/coverage/lcov-report/block-navigation.js`. `.gitignore` hides that
directory from git, but flat-config ESLint does not read `.gitignore`. `**/coverage` is now in the
lint ignore list, and three consecutive full runs pass.

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
- **AR-01 was the only ticket with no execution-time risk** and gated everything else. It is closed,
  so the remaining tickets are no longer blocked on a red pipeline.

## 8. Definition of done

- [x] All seven verification gates pass, including `npm audit --audit-level=high`. (AR-01, 2026-09-02)
- [x] No scheduled notification can remain selectable indefinitely, and the documented retry and
      email fallback are exercised by tests rather than described by comments. (AR-02, 2026-09-02)
- [x] A rejected full-capacity RSVP writes nothing, and no untyped error crosses a server-function
      boundary. (AR-04, 2026-09-02)
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
- [ ] No runtime import of `libs/server-fns`, `libs/db`, or `libs/domain` exists outside `api.ts`,
      and the boundary rule covers `features/` so a new one cannot land unnoticed.
- [x] No notification payload is cast rather than parsed, on either side of the row. (AR-13, 2026-09-02)
- [ ] The implementation plan's status table is updated from the evidence this plan produces, and no
      `Partial` or `Blocked` item is promoted without it.
