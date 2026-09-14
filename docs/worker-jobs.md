# Worker jobs

`apps/worker-jobs` is the non-UI Cloudflare Worker for asynchronous delivery, indexing, and
operational reconciliation. This document describes the current implementation and required
production architecture as checked on 2026-09-14.

The [community-building release](./release-strategy.md) requires only event reminders and the
operational work needed to run the local community reliably. Challenge, sponsor, billing, payment,
and nonessential embedding jobs remain future work even where processor foundations exist.

## Current implementation

| Entry point                                | Current behavior                                                                                           | Status                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `fetch`                                    | Returns the worker health response                                                                         | Complete                                                                                              |
| `NotificationScheduleDO` alarm, per event  | Publishes `notification_due` for that event onto the notifications queue, then rearms                      | Complete (CO-02); deployed to staging and production                                                  |
| `queue` handler, notifications             | Delivers everything the named event has due, push first with email fallback; SMS for same-day cancellation | Complete (CO-02); deployed to staging and production                                                  |
| scheduled trigger, every fifteen minutes   | Sweeps D1 for due rows no alarm announced, and releases abandoned claims                                   | Complete as a recovery job — explicitly not the primary scheduler                                     |
| scheduled trigger, daily                   | Reconciles pending-order counts, records the backlog metric, sweeps orphaned profile assets                | Complete as a recovery/operational job                                                                |
| `queue` handler, embeddings/reconciliation | Processors exist for both message families                                                                 | Partial: consumers are bound in both deployed environments with a dead-letter queue, nothing produces |

CO-02 replaced the minute-by-minute D1 scan. Timing is now per event, held by a Durable Object
alarm, and the cron is a recovery sweep behind it. ND-07 then made push the primary channel, email
the default fallback, and SMS a same-day-cancellation channel only. Staging proves the complete
push/email path; the production Worker still needs promotion of the post-CO-02 policy release.

## Notification architecture

```text
Event mutation (apps/ui)
  -> write the scheduled_notifications rows
  -> arm NOTIFICATION_SCHEDULE for the event at the earliest send_at
  -> the alarm fires and publishes { kind: 'notification_due', eventId } to NOTIFICATIONS
  -> worker-jobs consumes it and claims only that event's due rows
  -> PWA web push is attempted first
  -> email is written as a fallback row when push fails permanently
  -> SMS is used only for same-day cancellation disruption
```

- Durable Object alarms own per-entity timing. One object per event, named from the event id.
- The alarm rearms from `scheduled_notifications`, never from its own memory: rows arrive from more
  than one writer, and an object holding a private copy of the schedule would be wrong every time
  one of them wrote without it. It rearms no sooner than five minutes out, because the consumer has
  not run yet when it rearms and the rows it just announced are still due.
- The queue provides retry isolation and dead-letter handling. The message carries an event id and
  no content — a copy of a notification can be retried after the row it came from was cancelled or
  already delivered, so D1 holds the state and the message is only a wake-up.
- The fifteen-minute D1 sweep recovers missed alarms and abandoned claims; it is not the primary
  scheduler. Both paths share one `sweepNotifications` body, differing only in whether the claim is
  scoped to an event.
- The class lives here and `apps/ui` binds it across scripts, so **worker-jobs deploys first**.
- Email is the default event fallback as well as the authentication and explicitly email-based
  channel. SMS is reserved for same-day cancellation disruption, where an unread email could send
  someone to a venue unnecessarily.
- Notification preferences are enforced in `resolveDestination`, at send time rather than at enqueue
  time, so a switch turned off after a row was written still applies to that row.

## Queue processors

The worker currently recognizes these message families:

- notifications: push-first, email-fallback delivery commands, with SMS reserved for same-day
  cancellation disruption;
- embeddings: future Workers AI generation followed by Vectorize upsert; not required for launch;
- reconciliation: current community-operational checks and any dormant future payment checks.

Processor logic is kept separate from the thin Cloudflare handler so it can be tested directly. Cloudflare bindings themselves must be exercised through Miniflare or a real environment, never replaced by binding mocks.

## Queue provisioning

Provisioned 2026-09-04. Queues are created per environment rather than shared, because one queue
across both would let a staging message be delivered by production:

| Catalogue queue                   | Staging                                   | Production                                   |
| --------------------------------- | ----------------------------------------- | -------------------------------------------- |
| `founders-coffee-notifications`   | `founders-coffee-notifications-staging`   | `founders-coffee-notifications-production`   |
| `founders-coffee-embeddings-jobs` | `founders-coffee-embeddings-jobs-staging` | `founders-coffee-embeddings-jobs-production` |
| `founders-coffee-reconcile`       | `founders-coffee-reconcile-staging`       | `founders-coffee-reconcile-production`       |
| dead-letter                       | `founders-coffee-dlq-staging`             | `founders-coffee-dlq-production`             |

Each consumer sets `max_retries: 5` and the environment's dead-letter queue. One DLQ per
environment rather than one per queue: with no DLQ consumer it is a place to look rather than a
place to process, and three of them would be three places to forget to look.

`batch.queue` therefore arrives with the environment appended, while the handler has to route on one
name in every environment including Miniflare. `resolveQueueKind` in `libs/infra` resolves the
deployed name back to the catalogue name, matching the three known forms exactly rather than by
prefix — `startsWith` would route any queue whose name merely began with one of ours.

A name that resolves to nothing is now a **failure rather than an acknowledgement**. It used to
return `ok`, which acked and destroyed the message; it now retries and, after `max_retries`, lands in
the dead-letter queue where it can be read.

The notification producer is deployed with `NotificationScheduleDO` in both environments, so the
alarm/Queue path is active. The fifteen-minute sweep is recovery-only. Embeddings and reconcile
queues remain intentionally dormant until their approved producers exist.

## Provisioning requirements

Production operation requires:

- ~~consumer bindings for `NOTIFICATIONS` and any other enabled queue; retry limits and a
  dead-letter queue~~ — done 2026-09-04, see "Queue provisioning" below. The
  `NotificationScheduleDO` producer binding is deployed in both environments;
- an alert/replay runbook for the dead-letter queue;
- notification Durable Object bindings and migrations;
- D1, email, Firebase, Twilio, and Analytics bindings or credentials for the current community
  channels; Workers AI and Vectorize only if a separately approved current use is enabled;
- environment-specific resource names and verified staging delivery before production promotion.
  Staging push and email fallback are proven by ND-02; production policy parity remains a release check.

The declarations in source control do not prove that the resources exist in the Cloudflare account. See [provisioning.md](provisioning.md) for the dated verification state.

## Verification

- Unit-test message validation, channel selection, idempotency, and error classification.
- Use Miniflare for D1, Queues, Durable Objects, and supported Cloudflare bindings.
- Verify Workers AI, Vectorize, Firebase, Twilio, and sender configuration in staging where local emulation is insufficient.
- Exercise retry and dead-letter behavior before enabling production producers.
