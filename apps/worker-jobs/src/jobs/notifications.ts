import { ok, type Result } from '@founders-coffee/core';
import type { Db } from '@founders-coffee/db';

import type { NotificationDueMessage } from './messages.js';
import type { DispatchProviders } from './notification-dispatch.js';
import { sweepNotifications, type SweepReport } from './notification-sweep.js';

/**
 * Deliver everything one event has due, because its Durable Object said so.
 *
 * The message carries an event id and nothing else. It deliberately does not carry the content to
 * send: a queue message is a copy, and a copy of a notification can be retried after the row it
 * came from was cancelled, delivered by another consumer, or superseded. D1 holds the state, the
 * message is only a wake-up, and the claim inside the sweep is what makes two deliveries of the
 * same message deliver once.
 *
 * Always `ok`, so the message is acked. Nothing here is worth a queue retry: a row that failed has
 * already been recorded as failed, deferred to a later attempt or given its fallback by the sweep
 * itself, and re-running the same event a minute later would only re-claim rows the sweep has
 * already resolved. A message this Worker cannot route is the one that retries — see `dispatch` in
 * `index.ts` — and that is a routing defect, not a delivery one.
 */
export const processNotificationDue = async (
  db: Db,
  message: NotificationDueMessage,
  providers: DispatchProviders,
): Promise<Result<SweepReport>> =>
  ok(
    await sweepNotifications(db, providers, new Date(), {
      eventId: message.eventId,
    }),
  );
