# Events System Plan

## Member and host experience in `apps/ui`

| Field        | Value                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| Status       | Active; core loop implemented, launch hardening incomplete                       |
| Last updated | 2026-09-01                                                                       |
| Parent plan  | [Implementation plan, P1](./implementation-plan.md#5-phase-p1--community-launch) |
| Strategy     | [Community-first release](./release-strategy.md)                                 |
| Operations   | [Community Operations Plan](./community-operations-implementation-plan.md)       |

This plan is the core of the current community-building release. It covers the member and host event
experience required to create repeat local participation. `apps/dashboard` and payment operations
are future scope. `apps/admin` contributes only the lightweight trust, moderation, and operations
needed to run the community. The installable Serwist PWA is the committed mobile surface;
React Native/Expo is not committed scope.

## 1. Locked behavior

- DZ is `active`; EG and SA are self-serve `open`; MA and AE are `dark`.
- `/` geo-routes to a visible market and falls back to `/algeria`.
- Canonical market URLs use slugs (`/algeria`); code aliases redirect (`/dz` → `/algeria`).
- Locale resolution is preference/cookie → market default → `ar`. Supported locales are `ar`, `fr`, and `en`.
- Any authenticated member may host a free event in a visible market.
- RSVP is immediate and idempotent before event start. Create, cancel, and restore stop when trusted
  server time reaches `startsAt`, freezing the going set for attendance; there is no seat-hold or
  second confirmation lifecycle.
- PWA web push is the primary event-notification channel; SMS is fallback.
- The current UI uses email OTP and configured OAuth. Phone OTP via Twilio Verify is a dormant
  backend capability, not an active login flow. Notification fallback uses Twilio Programmable SMS
  through a separate provider contract.
- Per-event reminders use Durable Object alarms → Notifications Queue. Cron is recovery-only.

## 2. Implemented member flow

The location-onboarding step below records the legacy standalone login path. The approved
[profile/account plan](./profile-account-implementation-plan.md), PF-03, removes it and collects only
a missing display name, including inside the existing inline host sign-in gate. Event market/city
selection remains independent of a member's residence.

```text
discover market/city
  → authenticate when an action requires identity
  → complete home-location onboarding
  → create or view an event
  → RSVP or cancel
  → receive push/SMS reminders
  → use the live event dashboard
```

Implemented surfaces include:

- geo redirect, market landing, searchable city discovery, and empty-city hosting CTA;
- email-OTP UI, OAuth configuration, and phone-OTP backend capability (no phone login screen yet);
- onboarding, private profile, and public host profile;
- three-step host creation with Mapbox venue selection and local-time scheduling;
- virtualized event feed, city feed, event detail, host attribution, and SEO metadata;
- RSVP/cancellation UI and RSVP counts;
- PWA manifest/service worker and FCM subscription storage;
- Durable Object WebSocket live attendance state;
- anonymous city waitlist;
- scheduled-notification persistence and SMS/email/push delivery providers.

## 3. Required data flow

```text
component → feature hook → feature api.ts → server function → domain → repository → D1
```

Route loaders may call server functions for route wiring. Presentational components must not make runtime server-function, domain, or repository imports.

All inputs are validated by shared Zod schemas. TanStack Form is optional; local React state is approved when it reuses those schemas.

## 4. Geography

- D1 `markets` rows contain market state, default locale/currency/timezone, feature flags, and branding.
- `libs/domain/src/geo/data` contains versioned state/city reference datasets.
- Geographic event records carry `market_code`, `state_code`, and `city_code`.
- Adding or correcting geography currently requires a reviewed dataset change and deployment.
- Admin-managed geography is future scope and must not be claimed as implemented.

## 5. RSVP correctness

The desired operation is a single atomic D1 capacity decision plus idempotent membership:

- unlimited capacity is represented explicitly;
- a full event must not insert an RSVP row;
- duplicate RSVP attempts must not increment the counter;
- cancellation must not decrement twice or produce a negative count;
- creating, cancelling, or restoring an RSVP is permitted only while trusted server time is strictly
  before `startsAt`; the frozen going set is the sole person-level attendance-eligibility source;
- integration tests must exercise concurrent/full/duplicate/cancel paths and exact-start boundary
  races against real D1.

The current full-capacity path is **blocked** until the update/insert behavior is corrected and regression-tested.

## 6. Notification architecture

### Channel policy

1. Send PWA web push when the user has a valid subscription and permits the category.
2. Fall back to Twilio Programmable SMS when push is unavailable or permanently fails.
3. Use Cloudflare Email for authentication and explicitly email-based communications—not as the
   default event reminder. Future billing may use it only if that phase is approved.

### Scheduling policy

When an RSVP or event change creates reminder work:

1. persist the notification intent in D1;
2. schedule the event’s Durable Object alarm for the next due instant;
3. on alarm, enqueue due IDs to the Notifications Queue;
4. let `apps/worker-jobs` claim, deliver, and record outcomes idempotently;
5. retry transient failures through Queue policy and send exhausted work to a DLQ;
6. run a low-frequency Cron recovery sweep only for missed/stuck intents.

The current one-minute D1 scan and direct delivery are temporary non-compliant implementation. The
current producer also persists SMS/email work alongside push instead of selecting SMS only as the
push fallback. Scheduler migration and channel-policy correction are the highest-priority
notification remediation.

## 7. Live event dashboard

`EventLiveDO` coordinates an event’s live attendee state. Required behavior:

- only the event host or a currently RSVP’d attendee may connect;
- sessions are revalidated during the connection, not only at upgrade;
- pre-start cancelled RSVPs lose access; at/after start, the frozen going set controls access;
- all inbound messages are Zod-validated;
- stale connections are removed after heartbeat timeout;
- host/table/arrival state survives hibernation in Durable Object storage;
- client reconnect behavior is bounded and visibly fails after repeated authentication errors.

The feature is **Partial** until session-expiry, cancellation, and heartbeat behavior are fully verified.

## 8. Launch hardening

- Complete Turnstile coverage for event creation and RSVP.
- Retain the active shared Free-plan WAF rule in addition to identity-scoped Durable Object limits.
  Re-run the production behavioral probe after the apex DNS record serves traffic.
- Apply strict CSP and secure headers.
- Bind Analytics Engine and add delivery/density/error/SMS-cost dashboards and alerts.
- Verify offline shell, city/event prerendering, Lighthouse score, and optional PWA Builder packaging.
- Add Playwright coverage for signup → onboarding → create → RSVP → notification intent → cancel.
- Verify Arabic RTL plus French/English LTR.

## 9. Deferred work

- sponsorship surfaces and sponsor media (P1-011/P1-012);
- manual payment UI and non-community admin functionality (P1-014);
- semantic event search (P1-015);
- Browser Rendering OG images (P1-022);
- admin-managed geography;
- any separate native mobile application.

These items do not become active merely when launch hardening is complete. Sponsorship, challenge,
talent, payment, and expansion work requires the community validation gate and explicit Founder /
Product approval. Essential event moderation and lightweight host trust are current-release work,
not deferred monetization scope.

After EC-10 completes, the Community Operations Plan becomes the immediate next execution track. It
owns post-event closeout, attendance, feedback, repeat-host support, admin operations, trust,
moderation, and community-health evidence. This plan continues to own RSVP and notification
correctness; CO-02 treats those blockers as inherited prerequisites rather than redefining them.
