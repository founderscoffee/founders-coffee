import { and, eq, sql } from 'drizzle-orm';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { getNotification } from './notifications.js';
import { scheduledNotifications } from './schema.js';

export const NOTIFICATION_MAX_ATTEMPTS = 3;

/**
 * Mark a claimed notification as delivered, releasing the claim.
 *
 * Guarded on `status = 'processing'` so only the sweep that holds the claim can resolve the row:
 * a stale invocation returning late cannot overwrite the outcome of the sweep that reclaimed it.
 */
export const markNotificationSent = async (
  db: Db,
  opts: { id: string },
): Promise<void> => {
  await db
    .update(scheduledNotifications)
    .set({
      status: 'sent',
      claimedAt: null,
      dispatchStartedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledNotifications.id, opts.id),
        eq(scheduledNotifications.status, 'processing'),
      ),
    );
};

export const NOTIFICATION_RETRY_BACKOFF_SECONDS = [60, 300] as const;

export const NOTIFICATION_INSERT_COLUMNS = [
  'id',
  'event_id',
  'user_id',
  'channel',
  'status',
  'template_key',
  'payload',
  'send_at',
  'attempts',
  'last_error',
  'fallback_channel',
  'fallback_of',
  'claimed_at',
  'dispatch_started_at',
  'created_at',
  'updated_at',
] as const;

export interface NotificationFailure {
  readonly status: 'pending' | 'failed' | 'unknown';
  readonly attempts: number;
  readonly fallbackCreated: boolean;
}

/**
 * Record a delivery failure, deciding retry versus terminal failure inside the statement rather
 * than around it (AGENTS.md §11).
 *
 * While the attempt budget holds and the error is retryable, `attempts` is incremented, the error
 * recorded, `send_at` deferred by the backoff, and the row left `pending` so the next sweep picks
 * it up. When the budget is exhausted — or the provider reported a permanent error — the row goes
 * terminally `failed` and its fallback row, if it has a `fallback_channel`, is created in the same
 * batch. That is the only moment a fallback is created, which is what makes the documented
 * SMS-to-email fallback reachable at all.
 *
 * Exactly-once is a database invariant, not a timing argument: `fallback_of` is UNIQUE, so a
 * repeated failure path cannot spawn a second fallback for the same parent even if the update is
 * replayed. The update is guarded on `status = 'processing'`, so only the sweep holding the claim
 * can resolve the row; anything else is left alone and reported as `unknown`. A retry releases the
 * claim by clearing `claimed_at` and returning the row to `pending`.
 *
 * `suppressFallback` withholds the fallback insert for a failure that no channel could survive — a
 * closed account, a recipient that no longer exists. The fallback exists to reach someone another
 * way; when the refusal is about the person rather than the address, writing one only queues the
 * same refusal on a second channel and reports a delivery attempt that was never possible.
 *
 * `NOTIFICATION_RETRY_BACKOFF_SECONDS` is deliberately short — reminders are time-bound, and a
 * 72-hour reminder delivered a day late is noise. `NOTIFICATION_INSERT_COLUMNS` pins the column
 * list Drizzle generates from the schema for the fallback insert below; a new column on the table
 * would widen that list and break this insert at runtime only, so a test asserts the two agree.
 */
export const markNotificationFailed = async (
  db: Db,
  opts: {
    id: string;
    error: string;
    permanent: boolean;
    fallbackId: string;
    now: Date;
    suppressFallback?: boolean;
  },
): Promise<NotificationFailure> => {
  const nowSeconds = Math.floor(opts.now.getTime() / 1000);
  const isTerminal = sql`(${opts.permanent ? 1 : 0} = 1 OR attempts + 1 >= ${NOTIFICATION_MAX_ATTEMPTS})`;
  const backoffSeconds = sql`CASE WHEN attempts + 1 <= 1 THEN ${NOTIFICATION_RETRY_BACKOFF_SECONDS[0]} ELSE ${NOTIFICATION_RETRY_BACKOFF_SECONDS[1]} END`;

  const results = await batch(db, [
    db
      .update(scheduledNotifications)
      .set({
        attempts: sql`attempts + 1`,
        lastError: opts.error,
        status: sql`CASE WHEN ${isTerminal} THEN 'failed' ELSE 'pending' END`,
        sendAt: sql`CASE WHEN ${isTerminal} THEN send_at ELSE ${nowSeconds} + ${backoffSeconds} END`,
        claimedAt: null,
        dispatchStartedAt: null,
        updatedAt: sql`${nowSeconds}`,
      })
      .where(
        and(
          eq(scheduledNotifications.id, opts.id),
          eq(scheduledNotifications.status, 'processing'),
        ),
      ),
    db
      .insert(scheduledNotifications)
      .select(
        sql`SELECT ${opts.fallbackId}, event_id, user_id, fallback_channel, 'pending', template_key,
                   payload, ${nowSeconds}, 0, NULL, NULL, id, NULL, NULL, ${nowSeconds}, ${nowSeconds}
            FROM scheduled_notifications
            WHERE id = ${opts.id}
              AND status = 'failed'
              AND ${opts.suppressFallback ? 0 : 1} = 1
              AND fallback_channel IS NOT NULL`,
      )
      .onConflictDoNothing(),
  ]);

  const updated = (results[0] as { meta?: { changes?: number } }).meta?.changes;
  const inserted = (results[1] as { meta?: { changes?: number } }).meta
    ?.changes;
  const row = await getNotification(db, opts.id);

  return {
    status:
      (updated ?? 0) === 0
        ? 'unknown'
        : (row?.status ?? 'unknown') === 'failed'
          ? 'failed'
          : 'pending',
    attempts: row?.attempts ?? 0,
    fallbackCreated: (inserted ?? 0) > 0,
  };
};
