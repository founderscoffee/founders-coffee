import { id } from '@founders-coffee/core';
import {
  claimDueNotifications,
  listStaleClaims,
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
  readonly reclaimed: number;
  readonly contended: number;
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
 * "Resolves every one" is the invariant this function exists to hold. `claimDueNotifications`
 * returns a bounded window of the oldest due rows, so any row that can be selected without being
 * advanced occupies a slot in that window on every subsequent sweep. Enough of them and the window
 * fills with rows that can never leave it, and delivery stops on every channel at once — silently,
 * because nothing errors. Each path below therefore ends in `markNotificationSent` or
 * `markNotificationFailed` — through the shared `recordFailure`, so a reclaimed row and a failed
 * dispatch are accounted identically. A channel with no configured provider is terminal, a provider
 * that throws is a retryable failure, and a row whose bookkeeping itself fails is retried rather
 * than abandoning the rest of the window. `sent + retrying + failed + contended` therefore equals
 * `selected + reclaimed` on every run, `contended` being rows another sweep resolved first.
 *
 * Rows are claimed before anything is dispatched. Each sweep makes an outbound provider call per
 * row, so a run can outlast the one-minute cron tick; without the claim the next tick re-selected
 * the same `pending` rows and sent them all again. `claimDueNotifications` moves the window to
 * `processing` in one guarded statement and returns exactly the rows this caller won, so
 * overlapping sweeps operate on disjoint sets.
 *
 * Stale claims are released first, before new work is taken. An invocation that dies between
 * claiming and resolving leaves rows `processing` with nothing to advance them, so each sweep
 * routes anything past the claim timeout through the ordinary failure path — spending one attempt
 * and either deferring the row or retiring it, which is what stops a repeatedly dying run from
 * reclaiming the same row forever.
 *
 * Delivery remains at-least-once, and deliberately so: an invocation that dies after the provider
 * accepted a message but before the row was marked sent will send it again when the claim expires.
 * Closing that needs provider-side idempotency keys, not a database change. What the claim removes
 * is the routine case — every overlapping tick re-dispatching the entire window. A D1 write failure
 * likewise leaves a row claimed; the store being unavailable is the one case where state cannot be
 * recorded, and the claim timeout is what brings the row back.
 */
export const sweepNotifications = async (
  db: Db,
  providers: DispatchProviders,
  now: Date = new Date(),
): Promise<SweepReport> => {
  const dispatchers = buildDispatchers(db, providers);
  const tally = {
    sent: 0,
    retrying: 0,
    failed: 0,
    fallbacksCreated: 0,
    contended: 0,
  };

  const recordFailure = async (
    notification: ScheduledNotification,
    error: string,
    permanent: boolean,
  ): Promise<void> => {
    try {
      const failure = await markNotificationFailed(db, {
        id: notification.id,
        error,
        permanent,
        fallbackId: id('ntf'),
        now,
      });
      if (failure.fallbackCreated) tally.fallbacksCreated++;
      if (failure.status === 'failed') tally.failed++;
      else if (failure.status === 'pending') tally.retrying++;
      else tally.contended++;
    } catch {
      tally.retrying++;
    }
  };

  const stale = await listStaleClaims(db, { limit: SWEEP_LIMIT, now });
  for (const abandoned of stale) {
    await recordFailure(
      abandoned,
      'claim_expired: the sweep holding this row did not complete',
      false,
    );
  }

  const claimed = await claimDueNotifications(db, { limit: SWEEP_LIMIT, now });
  let unroutable = 0;

  for (const notification of claimed) {
    const dispatcher = dispatchers[notification.channel];
    if (!dispatcher) {
      unroutable++;
      await recordFailure(
        notification,
        `no_provider: channel '${notification.channel}' is not configured`,
        true,
      );
      continue;
    }

    const outcome = await dispatch(dispatcher, notification);
    if (outcome.kind === 'failed') {
      await recordFailure(notification, outcome.error, outcome.permanent);
      continue;
    }

    try {
      await markNotificationSent(db, { id: notification.id });
      tally.sent++;
    } catch {
      tally.retrying++;
    }
  }

  return {
    selected: claimed.length,
    reclaimed: stale.length,
    unroutable,
    ...tally,
  };
};
