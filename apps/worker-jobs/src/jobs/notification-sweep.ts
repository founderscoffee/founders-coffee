import { id } from '@founders-coffee/core';
import {
  beginNotificationDispatch,
  claimDueNotifications,
  listStaleClaims,
  markNotificationFailed,
  markNotificationSent,
} from '@founders-coffee/db';
import type { Db, ScheduledNotification } from '@founders-coffee/db';
import { notifications } from '@founders-coffee/domain';
import { logger } from '@founders-coffee/observability';

import {
  CHANNEL_SUPPRESSES_DUPLICATES,
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
  readonly unconfirmed: number;
  readonly invalidPayload: number;
  readonly unreachable: number;
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
  parsed: notifications.ParsedNotificationPayload,
): Promise<DispatchOutcome> => {
  try {
    return await dispatcher(notification, parsed);
  } catch (error) {
    return {
      kind: 'failed',
      permanent: false,
      error: `dispatch_threw: ${errorMessage(error)}`,
    };
  }
};

/**
 * Take the oldest due notifications, dispatch each on its channel, and resolve every one of them.
 *
 * Two callers, one body. `scope.eventId` is the alarm-driven path: an event's Durable Object fired,
 * its message reached the queue, and only that event's rows are claimed. Unscoped is the recovery
 * sweep, which runs on a slow cron and exists for the rows no alarm will ever announce — an event
 * whose object never armed, a queue message that died in the dead-letter queue, a row deferred to a
 * later attempt after its alarm had already moved on. Neither path is allowed to be the only one:
 * alarms make delivery prompt, the sweep makes it certain.
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
 * A row's payload is parsed before anything is dispatched, never cast. A persisted JSON blob
 * crossing back into code is untrusted input (§7, §10): a row written by an older schema or a
 * partial write would otherwise reach a provider with `undefined` in a required field, and the
 * provider's complaint would be filed as a delivery failure rather than the data defect it is. A
 * payload that does not parse is retired terminally with a distinguishable reason and logged, so it
 * is never dispatched and never selected again.
 *
 * Rows are claimed before anything is dispatched. Each sweep makes an outbound provider call per
 * row, so a run can outlast the tick or alarm that started it; without the claim the next one
 * re-selected the same `pending` rows and sent them all again. `claimDueNotifications` moves the
 * window to `processing` in one guarded statement and returns exactly the rows this caller won, so
 * an alarm-driven run and a recovery sweep that overlap operate on disjoint sets — which is what
 * lets both paths exist without either duplicating the other's deliveries.
 *
 * Stale claims are released first, before new work is taken. An invocation that dies between
 * claiming and resolving leaves rows `processing` with nothing to advance them, so each sweep
 * routes anything past the claim timeout through the ordinary failure path — spending one attempt
 * and either deferring the row or retiring it, which is what stops a repeatedly dying run from
 * reclaiming the same row forever.
 *
 * The window an invocation can die in is narrowed to the provider call itself.
 * `beginNotificationDispatch` records that a call is about to be made, and every resolution clears
 * it, so a reclaimed row says which of two things happened. If the marker is unset the row never
 * reached a provider and retrying is free. If it is set the outcome is unknowable — the message may
 * already be on its way — and the row is only resent on a channel that can suppress the duplicate.
 * On one that cannot, resending would put a second SMS on someone's phone to save a reminder they
 * have most likely already received, so the row is retired instead and its fallback, if it has one,
 * carries the delivery.
 *
 * Every run that touched anything logs its whole report, tagged with the event when it was
 * alarm-driven. The counters are the only externally visible account of delivery: nothing else
 * distinguishes a quiet hour from a sweep that refused a hundred rows for a missing provider, and
 * `sent + retrying + failed + contended = selected + reclaimed` is checkable from the log line
 * alone. A run that selected and reclaimed nothing logs nothing, so the recovery cron's ninety-six
 * daily wake-ups do not bury the runs that did something.
 *
 * That leaves no path that silently duplicates. It does not make delivery exactly-once, which is
 * not reachable against providers that offer no idempotency key: the guarantee is exactly-once on
 * push, at-most-once on SMS and email after an unconfirmed attempt, and at-least-once everywhere
 * else. A D1 write failure likewise leaves a row claimed; the store being unavailable is the one
 * case where state cannot be recorded, and the claim timeout is what brings the row back.
 */
export const sweepNotifications = async (
  db: Db,
  providers: DispatchProviders,
  now: Date = new Date(),
  scope: { eventId?: string } = {},
): Promise<SweepReport> => {
  const dispatchers = buildDispatchers(db, providers);
  const tally = {
    sent: 0,
    retrying: 0,
    failed: 0,
    fallbacksCreated: 0,
    contended: 0,
    unconfirmed: 0,
    invalidPayload: 0,
    unreachable: 0,
  };

  const recordFailure = async (
    notification: ScheduledNotification,
    error: string,
    permanent: boolean,
    suppressFallback = false,
  ): Promise<void> => {
    try {
      const failure = await markNotificationFailed(db, {
        id: notification.id,
        error,
        permanent,
        fallbackId: id('ntf'),
        now,
        suppressFallback,
      });
      if (failure.fallbackCreated) tally.fallbacksCreated++;
      if (failure.status === 'failed') tally.failed++;
      else if (failure.status === 'pending') tally.retrying++;
      else tally.contended++;
    } catch {
      tally.retrying++;
    }
  };

  const stale = await listStaleClaims(db, {
    limit: SWEEP_LIMIT,
    now,
    ...scope,
  });
  for (const abandoned of stale) {
    if (abandoned.dispatchStartedAt === null) {
      await recordFailure(
        abandoned,
        'claim_expired: the sweep holding this row did not complete',
        false,
      );
      continue;
    }

    tally.unconfirmed++;
    const resendable = CHANNEL_SUPPRESSES_DUPLICATES[abandoned.channel];
    await recordFailure(
      abandoned,
      `dispatch_unconfirmed: the provider may already have accepted this message; ${
        resendable
          ? 'resending because the channel suppresses a duplicate'
          : 'not resending because the channel cannot suppress a duplicate'
      }`,
      !resendable,
    );
  }

  const claimed = await claimDueNotifications(db, {
    limit: SWEEP_LIMIT,
    now,
    ...scope,
  });
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

    const parsed = notifications.parseNotificationPayload(
      notification.channel,
      notification.payload,
    );
    if (!parsed.ok) {
      tally.invalidPayload++;
      logger.error('notification.invalid_payload', {
        id: notification.id,
        channel: notification.channel,
        reason: parsed.reason,
      });
      await recordFailure(
        notification,
        `invalid_payload: ${parsed.reason}`,
        true,
      );
      continue;
    }

    await beginNotificationDispatch(db, { id: notification.id, now });
    const outcome = await dispatch(dispatcher, notification, parsed.value);
    if (outcome.kind === 'failed') {
      if (outcome.unreachable) tally.unreachable++;
      await recordFailure(
        notification,
        outcome.error,
        outcome.permanent,
        outcome.suppressFallback,
      );
      continue;
    }

    try {
      await markNotificationSent(db, { id: notification.id });
      tally.sent++;
    } catch {
      tally.retrying++;
    }
  }

  const report: SweepReport = {
    selected: claimed.length,
    reclaimed: stale.length,
    unroutable,
    ...tally,
  };

  if (report.selected > 0 || report.reclaimed > 0)
    logger.info('notification.sweep', { ...report, eventId: scope.eventId });

  return report;
};
