# Worker jobs

`apps/worker-jobs` is the non-UI Cloudflare Worker for asynchronous delivery, indexing, and operational reconciliation. This document describes both the current implementation and the required production architecture as of 2026-08-30.

The [community-building release](./release-strategy.md) requires only event reminders and the
operational work needed to run the local community reliably. Challenge, sponsor, billing, payment,
and nonessential embedding jobs remain future work even where processor foundations exist.

## Current implementation

| Entry point                     | Current behavior                                                             | Status                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `fetch`                         | Returns the worker health response                                           | Complete                                                                                                                |
| scheduled trigger, every minute | Queries D1 for due notifications and delivers them directly                  | Blocked: violates the per-entity scheduling decision                                                                    |
| scheduled trigger, daily        | Reconciles pending-order counts and records the backlog metric               | Complete as a recovery/operational job                                                                                  |
| `queue` handler                 | Contains processors for notification, embedding, and reconciliation messages | Partial: consumers are bound in both deployed environments with a dead-letter queue, but nothing produces into them yet |

The minute-by-minute D1 notification scan is temporary operational debt. The persisted notification
set also currently causes SMS/email work to coexist with push rather than invoking SMS strictly as
the fallback. Neither behavior is the intended design or a basis for additional timed features.

## Required notification architecture

```text
Event mutation
  -> schedule a Durable Object alarm for the entity
  -> alarm publishes a delivery command to NOTIFICATIONS
  -> worker-jobs consumes the message
  -> PWA web push is attempted first
  -> SMS is used as the fallback when push is unavailable or fails
```

- Durable Object alarms own per-entity timing.
- The queue provides retry isolation and dead-letter handling.
- A low-frequency D1 sweep may recover missed alarms; it is not the primary scheduler.
- Email remains appropriate for authentication and explicitly email-based workflows. Future billing
  may use email if that phase is opened. Email is not the default event-reminder channel.
- Notification preferences and idempotency must be enforced before delivery.

This migration is the highest-priority platform blocker in the active implementation plan.

## Queue processors

The worker currently recognizes these message families:

- notifications: push/SMS/email delivery commands;
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

**Nothing produces into these queues yet.** The consumer is reachable but unfed, and notification
delivery still runs on the one-minute D1 sweep. The producer is part of the Durable Object alarm
migration above, not of this provisioning.

## Provisioning requirements

Production operation requires:

- ~~consumer bindings for `NOTIFICATIONS` and any other enabled queue; retry limits and a
  dead-letter queue~~ — done 2026-09-04, see "Queue provisioning" below. A **producer** binding is
  still required, and is the substance of the migration above;
- an alert/replay runbook for the dead-letter queue;
- notification Durable Object bindings and migrations;
- D1, email, Firebase, Twilio, and Analytics bindings or credentials for the current community
  channels; Workers AI and Vectorize only if a separately approved current use is enabled;
- environment-specific resource names and verified staging delivery before production promotion.

The declarations in source control do not prove that the resources exist in the Cloudflare account. See [provisioning.md](provisioning.md) for the dated verification state.

## Verification

- Unit-test message validation, channel selection, idempotency, and error classification.
- Use Miniflare for D1, Queues, Durable Objects, and supported Cloudflare bindings.
- Verify Workers AI, Vectorize, Firebase, Twilio, and sender configuration in staging where local emulation is insufficient.
- Exercise retry and dead-letter behavior before enabling production producers.
