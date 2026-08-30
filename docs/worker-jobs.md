# Worker jobs

`apps/worker-jobs` is the non-UI Cloudflare Worker for asynchronous delivery, indexing, and operational reconciliation. This document describes both the current implementation and the required production architecture as of 2026-08-30.

## Current implementation

| Entry point                     | Current behavior                                                             | Status                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `fetch`                         | Returns the worker health response                                           | Complete                                                                                   |
| scheduled trigger, every minute | Queries D1 for due notifications and delivers them directly                  | Blocked: violates the per-entity scheduling decision                                       |
| scheduled trigger, daily        | Reconciles pending-order counts and records the backlog metric               | Complete as a recovery/operational job                                                     |
| `queue` handler                 | Contains processors for notification, embedding, and reconciliation messages | Partial: consumer code exists, but production queue bindings and delivery are not verified |

The minute-by-minute D1 notification scan is temporary operational debt. The persisted notification
set also currently causes SMS/email work to coexist with push rather than invoking SMS strictly as
the fallback. Neither behavior is the intended design or a basis for additional timed features.

## Required notification architecture

```text
Event or challenge mutation
  -> schedule a Durable Object alarm for the entity
  -> alarm publishes a delivery command to NOTIFICATIONS
  -> worker-jobs consumes the message
  -> PWA web push is attempted first
  -> SMS is used as the fallback when push is unavailable or fails
```

- Durable Object alarms own per-entity timing.
- The queue provides retry isolation and dead-letter handling.
- A low-frequency D1 sweep may recover missed alarms; it is not the primary scheduler.
- Email remains appropriate for authentication, billing, and explicitly email-based workflows. It is not the default event-reminder channel.
- Notification preferences and idempotency must be enforced before delivery.

This migration is the highest-priority platform blocker in the active implementation plan.

## Queue processors

The worker currently recognizes these message families:

- notifications: push/SMS/email delivery commands;
- embeddings: Workers AI generation followed by Vectorize upsert;
- reconciliation: operational checks and metrics.

Processor logic is kept separate from the thin Cloudflare handler so it can be tested directly. Cloudflare bindings themselves must be exercised through Miniflare or a real environment, never replaced by binding mocks.

## Provisioning requirements

Production operation requires:

- producer and consumer bindings for `NOTIFICATIONS` and any other enabled queue;
- retry limits and a dead-letter queue with an alert/replay runbook;
- notification Durable Object bindings and migrations;
- D1, Workers AI, Vectorize, email, Firebase, Twilio, and Analytics bindings or credentials for the channels actually enabled;
- environment-specific resource names and verified staging delivery before production promotion.

The declarations in source control do not prove that the resources exist in the Cloudflare account. See [provisioning.md](provisioning.md) for the dated verification state.

## Verification

- Unit-test message validation, channel selection, idempotency, and error classification.
- Use Miniflare for D1, Queues, Durable Objects, and supported Cloudflare bindings.
- Verify Workers AI, Vectorize, Firebase, Twilio, and sender configuration in staging where local emulation is insufficient.
- Exercise retry and dead-letter behavior before enabling production producers.
