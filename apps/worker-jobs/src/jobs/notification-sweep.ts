import { id } from '@founders-coffee/core';
import {
  listPendingNotifications,
  markNotificationFailed,
  markNotificationSent,
} from '@founders-coffee/db';
import type { Db, ScheduledNotification } from '@founders-coffee/db';

import {
  buildDispatchers,
  type DispatchOutcome,
  type DispatchProviders,
  type Dispatcher,
} from './notification-dispatch.js';

const SWEEP_LIMIT = 100;

export interface SweepReport {
  readonly selected: number;
  readonly sent: number;
  readonly retrying: number;
  readonly failed: number;
  readonly unroutable: number;
  readonly fallbacksCreated: number;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Run one dispatcher, converting a thrown provider error into a retryable failure.
 *
 * A provider that throws must not abort the sweep: the rows behind it are due too, and an
 * exception escaping here would leave every one of them `pending` for the next sweep to re-select.
 */
const dispatch = async (
  dispatcher: Dispatcher,
  notification: ScheduledNotification,
): Promise<DispatchOutcome> => {
  try {
    return await dispatcher(notification);
  } catch (error) {
    return {
      kind: 'failed',
      permanent: false,
      error: `dispatch_threw: ${errorMessage(error)}`,
    };
  }
};

/**
 * Cron-driven sweep: takes the oldest due notifications, dispatches each on its channel, and
 * resolves every one of them.
 *
 * "Resolves every one" is the invariant this function exists to hold. `listPendingNotifications`
 * returns a bounded window of the oldest due rows, so any row that can be selected without being
 * advanced occupies a slot in that window on every subsequent sweep. Enough of them and the window
 * fills with rows that can never leave it, and delivery stops on every channel at once — silently,
 * because nothing errors. Each path below therefore ends in `markNotificationSent` or
 * `markNotificationFailed`: a channel with no configured provider is terminal, a provider that
 * throws is a retryable failure, and a row whose bookkeeping itself fails is retried rather than
 * abandoning the rest of the window.
 *
 * Two bounds are deliberately left to AR-03, which adds the claim/lease this does not have. Two
 * overlapping sweeps both select the same rows, so a row can be dispatched twice; delivery is
 * at-least-once, not exactly-once. The `status = 'pending'` guard inside `markNotificationFailed`
 * still means only one of them advances the row, and `fallback_of` still means only one fallback
 * is created. A D1 write failure also leaves a row untouched — the store being unavailable is the
 * one case where state cannot be recorded, and the next sweep retries it.
 */
export const sweepNotifications = async (
  db: Db,
  providers: DispatchProviders,
  now: Date = new Date(),
): Promise<SweepReport> => {
  const dispatchers = buildDispatchers(db, providers);
  const pending = await listPendingNotifications(db, {
    limit: SWEEP_LIMIT,
    now,
  });

  let sent = 0;
  let retrying = 0;
  let failedCount = 0;
  let unroutable = 0;
  let fallbacksCreated = 0;

  for (const notification of pending) {
    const dispatcher = dispatchers[notification.channel];

    const outcome: DispatchOutcome = dispatcher
      ? await dispatch(dispatcher, notification)
      : {
          kind: 'failed',
          permanent: true,
          error: `no_provider: channel '${notification.channel}' is not configured`,
        };
    if (!dispatcher) unroutable++;

    try {
      if (outcome.kind === 'sent') {
        await markNotificationSent(db, { id: notification.id });
        sent++;
        continue;
      }

      const failure = await markNotificationFailed(db, {
        id: notification.id,
        error: outcome.error,
        permanent: outcome.permanent,
        fallbackId: id('ntf'),
        now,
      });
      if (failure.fallbackCreated) fallbacksCreated++;
      if (failure.status === 'failed') failedCount++;
      else if (failure.status === 'pending') retrying++;
    } catch {
      retrying++;
    }
  }

  return {
    selected: pending.length,
    sent,
    retrying,
    failed: failedCount,
    unroutable,
    fallbacksCreated,
  };
};
