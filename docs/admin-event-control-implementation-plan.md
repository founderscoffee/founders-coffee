# Admin Event Control Implementation Plan

| Field                   | Value                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Status                  | Proposed; product decisions confirmed 2026-09-20                                                            |
| Parent tickets          | P1-013, P1-023; extends CO-08 and CO-09                                                                     |
| Requirements            | FR-M1, FR-M2, FR-M4, FR-M6, FR-M9, FR-M10; NFR-4, NFR-5, NFR-7 through NFR-12                               |
| Scope                   | Event moderation and operations control across `apps/admin`, `apps/ui`, `libs/*`, and notification delivery |
| Explicitly out of scope | Payments, sponsorship, CRM, automated host outreach, and commercial controls                                |

## 1. Confirmed product decisions

1. Moderators need a real permission system, not a role-wide boolean. Permissions must be explicit,
   auditable, and scoped to the markets they are assigned to.
2. Admin event actions are reversible. “Delete” is a reversible archive action by default.
3. Moderation does not directly edit event content. It requests a host fix, then reviews the host's
   submitted correction.
4. A hidden event is visible to the host only inside a private host dashboard/remediation view. It is
   not available through the public event URL.
5. Attendees receive a localized notification when an event is hidden, cancelled, or deleted/archived.
   Internal moderation notes and sensitive reasons never reach attendees.
6. Moderator permissions and market assignments are a first-class system capability, shared by every
   admin server function and never checked ad hoc in UI code.
7. Archive is the normal delete behavior. Hard deletion is a separate, restricted data-removal path
   allowed only when no retained event or participant evidence depends on the row.

## 2. Audit baseline

The existing system provides a strong foundation but not the requested control surface:

- `apps/admin` has the Access JWT + Better Auth correlation and an operator status page, but no event
  list, event detail, moderation queue, or event mutation UI.
- Events currently have only `published` and `cancelled` lifecycle states. Moderation visibility is not
  modeled separately.
- Host cancellation already cancels pending reminders, queues attendee notices, and closes the live
  event path. Admin cancellation must reuse this behavior.
- Closeouts, attendance, feedback, host trust, weekly reviews, and append-only operations audit rows
  already exist and must remain intact when an event is hidden, cancelled, or archived.
- Public feed, city counts, sitemap, JSON discovery, map data, host history, joined events, RSVP
  eligibility, and event detail all need one consistent moderation predicate.
- Event foreign keys cascade into RSVP and operational records, so physical deletion is unsafe as the
  normal product action.

Authoritative references:

- [SRS admin and moderation requirements](./srs.md#58-admin--moderation-p0p1)
- [Community operations baseline and locked decisions](./community-operations-implementation-plan.md#4-current-baseline-and-gaps-reviewed-2026-09-14)
- [Existing CO-08 operations workspace](./community-operations-implementation-plan.md#co-08--build-the-admin-event-operations-workspace)
- [Existing CO-09 moderation and trust scope](./community-operations-implementation-plan.md#co-09--implement-host-trust-moderation-and-audit)

## 3. State model

Publication lifecycle and moderation state stay separate.

### Publication lifecycle

- `published`: event can be visible when moderation allows it.
- `cancelled`: event will not occur; the existing cancellation page and participant notice remain.

### Current moderation state

- `visible`: public discovery and event detail are allowed.
- `hidden`: removed from public discovery while an operator investigates or takes an immediate safety
  action.
- `awaiting_host_fix`: host must correct the event through the private dashboard.
- `pending_review`: host submitted a correction; it remains private until reviewed.
- `archived`: reversible delete; excluded from all public and host discovery surfaces unless explicitly
  requested in the private dashboard or admin archive view.

Allowed transitions are implemented in `libs/domain` and reject invalid or stale transitions:

```text
visible -> hidden -> awaiting_host_fix -> pending_review -> visible
visible -> cancelled
hidden -> archived
awaiting_host_fix -> archived
pending_review -> hidden | visible | archived
archived -> visible | hidden
```

Cancellation and archive are distinct. Cancellation explains that an event will not happen; archive
removes an event from normal product surfaces while preserving its history.

## 4. Permission and market-assignment system

### Permission records

Extend centralized RBAC with explicit capabilities rather than adding role comparisons to routes:

- `events.read`
- `events.hide`
- `events.request_fix`
- `events.review_fix`
- `events.restore`
- `events.cancel`
- `events.archive`
- `events.hard_delete`
- `audit.read`

Add a D1-backed moderator grant model with:

- Better Auth user ID;
- market code;
- permission key;
- granted by, granted at, revoked by, revoked at;
- optional expiry;
- optimistic version.

The central authorization helper resolves the operator's role, active grants, and market scope in one
place. Every admin server function receives that trusted context. Unknown roles, revoked grants,
expired grants, and unassigned markets fail closed.

### Recommended default access

- `moderator`: read, hide, request host fix, review submitted fixes, restore, cancel, archive within
  assigned markets; no hard delete.
- `admin`: all moderator permissions, permission/grant management, cross-market access when explicitly
  granted, and hard-delete approval.

The permission-management UI must show who granted each permission and allow revocation without
changing the user's Better Auth role.

## 5. Data and domain work

### CO-08A — Contracts and schemas

- Add moderation statuses, event-control actions, reason codes, and typed outcomes to `libs/core`.
- Add Zod schemas for filters, actions, reasons, bounded notes, remediation text, and optimistic
  versions.
- Keep moderation reasons separate from closeout reasons. Recommended values are `safety`, `policy`,
  `spam`, `misleading`, `duplicate`, `venue_unavailable`, `data_entry_error`, `member_report`,
  `host_request`, `legal_request`, and `other_structured`.
- Add localized host-facing and attendee-facing copy for `ar`, `fr`, and `en`.

### CO-08B — Migration and repositories

- Add an `event_moderation` current-state table, indexed by market, city, state, status, and update
  time.
- Store reason code, bounded private note, host remediation message, actor identities, timestamps,
  and version.
- Add moderator market grants and indexes for active permission lookup.
- Add repositories for moderation queue, event detail, audit history, grants, transitions, and hard-
  delete eligibility.
- Pair every state mutation with an atomic append-only `operations_audit` row containing before/after
  state, reason, actor user ID, Access subject, and market.

### CO-08C — Pure state machine

Implement the transition rules in `libs/domain` and cover:

- valid transitions;
- required reason and note rules;
- cancellation/archive interaction;
- restore behavior;
- stale version rejection;
- host submission eligibility;
- hard-delete eligibility.

### CO-08D — Admin server functions

Add market-scoped, authenticated server functions for:

- listing/filtering events;
- loading event detail and audit history;
- hiding an event;
- requesting a host fix;
- reviewing a submitted fix;
- restoring an event;
- cancelling an event;
- archiving/deleting an event;
- managing moderator grants;
- approving a restricted hard-delete request.

Every mutation requires Zod validation, Access + Better Auth correlation, centralized permission,
market authorization, Durable Object rate limiting, WAF coverage, typed errors, structured logs, and
an atomic audit write. No admin mutation uses Turnstile because it is session-authenticated.

## 6. Notifications and side effects

### Host

The host receives the exact moderation state, a localized reason, and the requested correction through
the private host dashboard. Internal notes remain private to operators.

### Attendees

Attendees receive a localized status notice for all three requested actions:

- hidden: the event is temporarily unavailable and they should await an update;
- cancelled: the event will not happen and existing cancellation semantics apply;
- archived/deleted: the event is no longer available.

Pending reminders are cancelled for hidden and archived events. Existing submitted feedback and
retained attendance evidence are preserved. Admin cancellation reuses the current attendee notice and
live-room shutdown path.

Add idempotent notification template keys and tests for push/email fallback, duplicate delivery, and
locale rendering.

## 7. Host remediation in `apps/ui`

Add a private, authenticated host dashboard section that shows:

- moderation state;
- safe reason and remediation guidance;
- fields requiring correction;
- editable event form using the shared event schema;
- submit-for-review action;
- pending-review status and history.

The public event URL must resolve to not-found for hidden, awaiting-fix, pending-review, and archived
events. The host dashboard uses a private resolver that requires ownership and active session. Hosts
cannot self-restore an event.

## 8. Admin workspace in `apps/admin`

Create thin routes and domain feature modules. All tabular admin data uses **TanStack Table** for sorting,
filtering, column visibility, row selection, and pagination. Use **TanStack Virtual** for large event, audit, and permission result sets; do not hand-build table state in components.

- `/events`: TanStack Table with cursor-paginated operations rows containing market, city, date, host, RSVP count, lifecycle, moderation state, and reason filters;
- `/events/$eventId`: canonical event detail, location, RSVP/attendance, closeout, feedback aggregates, notification delivery, current moderation state, and audit timeline;
- `/events/moderation`: TanStack Table queues for hidden and pending-review events;
- `/events/archived`: TanStack Table for the reversible delete archive;
- `/permissions/moderators`: TanStack Table for market-scoped grant management.

Action panels require confirmation, reason selection, bounded note where applicable, affected-user
summary, and stale-version handling. “Delete” is labeled as a reversible archive action until a
separate hard-delete approval flow is intentionally opened.

All admin screens need loading, empty, error, forbidden, keyboard, and Arabic RTL states. The public
host/member surfaces retain `ar`, `fr`, and `en` coverage. No admin component imports server
functions directly; use feature `api.ts` and Query hooks.

## 9. Public read-path updates

Apply one shared moderation predicate to:

- public feed and city/state counters;
- event detail and structured SEO data;
- sitemap and JSON discovery feed;
- map markers;
- public host history and joined-event pages;
- live-room authorization;
- RSVP creation and waitlist eligibility.

Admin and owner-private resolvers may include hidden or archived events with explicit authorization.
No public response should reveal internal moderation reasons or notes.

## 10. Verification plan

### Unit and domain

- transition matrix and invalid-state tests;
- permission and market-grant resolution;
- reason/note validation;
- hard-delete eligibility;
- notification classification.

### Miniflare integration

- migrations and indexes;
- atomic transition + audit writes;
- stale concurrent updates;
- market isolation;
- cancellation/reminder/live-room side effects;
- archive preserving RSVP, attendance, feedback, closeout, and audit evidence;
- hard-delete refusal when dependencies exist;
- grant revocation and expiry.

### Component and E2E

- admin filters, queues, confirmation dialogs, and permission errors;
- TanStack Table sorting, filtering, pagination, column visibility, keyboard row actions, and virtualized large lists;
- host remediation dashboard;
- public not-found behavior for private states;
- Arabic RTL admin rendering, with public `apps/ui` locale coverage tested separately;
- flow: create → hide → host fix → review → restore;
- flow: cancel → notify → reminders stop → live room closes;
- flow: archive → attendee notice → restore.

## 11. Rollout sequence

1. Ship schemas, grants, repositories, and read-only admin event list.
2. Enable hidden/request-fix/pending-review behind `communityOperations`.
3. Enable host private remediation dashboard.
4. Enable restore and admin cancellation.
5. Enable reversible archive/delete.
6. Run staging rehearsal with separate moderator and admin identities across assigned markets.
7. Keep hard delete disabled until retention/legal review and explicit Founder approval.
8. Promote with migration, notification, audit, and rollback evidence.

## 12. Definition of done

- Moderator permissions are grant-based, market-scoped, revocable, expiry-aware, and centrally tested.
- Every event action is reversible, validated, authorized, rate-limited, and audited.
- Hide/cancel/archive notifications reach affected attendees exactly once per action.
- Hosts see remediation only through a private dashboard and cannot restore events themselves.
- Public surfaces consistently exclude private moderation states.
- RSVP, attendance, feedback, closeout, notification, and audit evidence survive archive.
- Hard delete is impossible when retained dependencies exist.
- Admin flows pass Miniflare, component, accessibility, Arabic RTL, and staging E2E checks; public host/member flows retain their `ar`/`fr`/`en` RTL/LTR coverage.
