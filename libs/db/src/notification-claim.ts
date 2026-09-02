import { and, asc, eq, lte, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import {
  scheduledNotifications,
  type ScheduledNotification,
} from './schema.js';

export const NOTIFICATION_CLAIM_TIMEOUT_SECONDS = 900;

/**
 * Atomically take ownership of the oldest due notifications before anything is dispatched.
 *
 * The sweep makes an outbound provider call per row, so a run of a hundred rows can outlast the
 * one-minute cron tick. Without a claim the next tick re-selects the same still-`pending` rows and
 * sends them all again. A single guarded `UPDATE ... RETURNING` moves them to `processing` and
 * hands back exactly the rows this caller won, so two overlapping sweeps operate on disjoint sets:
 * the loser's `status = 'pending'` predicate no longer matches.
 *
 * Claiming is not the same as delivering. A row is released back to `pending` by the retry path or
 * retired by the terminal path, and an invocation that dies mid-run leaves its rows `processing`
 * with a `claimed_at` — {@link listStaleClaims} is how they come back.
 */
export const claimDueNotifications = async (
  db: Db,
  opts: { limit: number; now: Date },
): Promise<ScheduledNotification[]> => {
  const nowSeconds = Math.floor(opts.now.getTime() / 1000);
  return db
    .update(scheduledNotifications)
    .set({
      status: 'processing',
      claimedAt: opts.now,
      updatedAt: opts.now,
    })
    .where(
      sql`id IN (
            SELECT id FROM scheduled_notifications
            WHERE status = 'pending' AND send_at <= ${nowSeconds}
            ORDER BY send_at, id
            LIMIT ${opts.limit}
          )`,
    )
    .returning();
};

/**
 * Rows still `processing` past the claim timeout, oldest claim first.
 *
 * The timeout must comfortably outlast the slowest plausible sweep of `SWEEP_LIMIT` rows. If it
 * does not, a later sweep reclaims rows the first is still dispatching and sends them again —
 * turning the claim into the very duplicate it exists to prevent. Fifteen minutes is chosen against
 * a hundred serial provider calls at their timeout, not against their typical latency. The cost of
 * erring long is that a genuinely dead sweep's rows wait that long before retrying, which is
 * acceptable for reminders scheduled hours ahead.
 *
 * Their owning invocation died between claiming and resolving them, so the outcome of that attempt
 * is unknown. The caller routes each through the ordinary failure path, which spends one attempt
 * from the budget and either defers the row for another try or retires it — so a run that keeps
 * dying cannot reclaim the same row forever.
 */
export const listStaleClaims = async (
  db: Db,
  opts: { limit: number; now: Date },
): Promise<ScheduledNotification[]> => {
  const cutoff = new Date(
    opts.now.getTime() - NOTIFICATION_CLAIM_TIMEOUT_SECONDS * 1000,
  );
  return db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.status, 'processing'),
        lte(scheduledNotifications.claimedAt, cutoff),
      ),
    )
    .orderBy(
      asc(scheduledNotifications.claimedAt),
      asc(scheduledNotifications.id),
    )
    .limit(opts.limit);
};

/**
 * Record that a provider call is about to be made for a claimed row.
 *
 * This is the only durable trace that an outbound message may have been accepted. Without it a
 * sweep that dies mid-run is indistinguishable from one that died before dispatching, and the
 * reclaim has to guess: resend and risk a duplicate, or drop and risk a loss. Written immediately
 * before the call and cleared by every resolution, so the marker is set for exactly the window in
 * which the outcome is unknowable.
 *
 * Guarded on the claim, so a sweep that has lost its claim cannot mark a dispatch it no longer owns.
 */
export const beginNotificationDispatch = async (
  db: Db,
  opts: { id: string; now: Date },
): Promise<void> => {
  await db
    .update(scheduledNotifications)
    .set({ dispatchStartedAt: opts.now, updatedAt: opts.now })
    .where(
      and(
        eq(scheduledNotifications.id, opts.id),
        eq(scheduledNotifications.status, 'processing'),
      ),
    );
};
