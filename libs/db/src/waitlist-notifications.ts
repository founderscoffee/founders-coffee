import { and, asc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';

import type { Locale } from '@founders-coffee/core';

import { chunked, D1_MAX_BOUND_PARAMETERS } from './d1-limits.js';
import type { Db } from './db.js';
import {
  cityWaitlist,
  cityWaitlistNotifications,
  type CityWaitlistNotificationRow,
} from './schema.js';

const STALE_CLAIM_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

/**
 * Claim up to `limit` of a round's due notices for this invocation, in one statement.
 *
 * The rows move to `processing` in the same UPDATE that picks them, so two invocations working the
 * same round, the queue message and the recovery sweep, can never claim the same notice.
 */
export const claimCityWaitlistNotifications = async (
  db: Db,
  input: { launchId: string; limit: number; now: Date },
): Promise<CityWaitlistNotificationRow[]> =>
  db
    .update(cityWaitlistNotifications)
    .set({ status: 'processing', claimedAt: input.now, updatedAt: input.now })
    .where(
      sql`id IN (
        SELECT id FROM city_waitlist_notifications
        WHERE launch_id = ${input.launchId}
          AND status = 'pending'
          AND next_attempt_at <= ${Math.floor(input.now.getTime() / 1000)}
        ORDER BY next_attempt_at, id
        LIMIT ${input.limit}
      )`,
    )
    .returning();

/**
 * The address and language each claimed notice goes to, keyed by waitlist entry id.
 */
export const listWaitlistRecipients = async (
  db: Db,
  waitlistIds: readonly string[],
): Promise<Map<string, { email: string; locale: Locale }>> => {
  const recipients = new Map<string, { email: string; locale: Locale }>();
  for (const ids of chunked(waitlistIds, D1_MAX_BOUND_PARAMETERS)) {
    const rows = await db
      .select({
        id: cityWaitlist.id,
        email: cityWaitlist.email,
        locale: cityWaitlist.locale,
      })
      .from(cityWaitlist)
      .where(inArray(cityWaitlist.id, ids));
    for (const row of rows)
      recipients.set(row.id, { email: row.email, locale: row.locale });
  }
  return recipients;
};

/**
 * A round's notices claimed more than fifteen minutes ago and never finished.
 */
export const listStaleCityWaitlistNotifications = async (
  db: Db,
  input: { launchId: string; limit: number; now: Date },
): Promise<CityWaitlistNotificationRow[]> =>
  db
    .select()
    .from(cityWaitlistNotifications)
    .where(
      and(
        eq(cityWaitlistNotifications.launchId, input.launchId),
        eq(cityWaitlistNotifications.status, 'processing'),
        lte(
          cityWaitlistNotifications.claimedAt,
          new Date(input.now.getTime() - STALE_CLAIM_MS),
        ),
      ),
    )
    .orderBy(asc(cityWaitlistNotifications.claimedAt))
    .limit(input.limit);

/**
 * Record that a claimed notice is about to be handed to the email provider.
 *
 * Returns false when the notice is no longer claimed, because its meetup was cancelled after the
 * claim, and then nothing may be sent. Once this has returned true, a notice that never reports
 * back is failed for good rather than retried, so an unconfirmed send is never sent twice.
 */
export const beginCityWaitlistNotificationDispatch = async (
  db: Db,
  input: { id: string; now: Date },
): Promise<boolean> => {
  const result = await db
    .update(cityWaitlistNotifications)
    .set({ dispatchStartedAt: input.now, updatedAt: input.now })
    .where(
      and(
        eq(cityWaitlistNotifications.id, input.id),
        eq(cityWaitlistNotifications.status, 'processing'),
        isNull(cityWaitlistNotifications.dispatchStartedAt),
      ),
    );
  return ((result.meta?.changes ?? 0) as number) > 0;
};

/**
 * Record a delivered notice and the entry it was owed to, together.
 */
export const markCityWaitlistNotificationSent = async (
  db: Db,
  input: { id: string; waitlistId: string; now: Date },
): Promise<void> => {
  await db.batch([
    db
      .update(cityWaitlistNotifications)
      .set({
        status: 'sent',
        sentAt: input.now,
        claimedAt: null,
        dispatchStartedAt: null,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(cityWaitlistNotifications.id, input.id),
          eq(cityWaitlistNotifications.status, 'processing'),
        ),
      ),
    db
      .update(cityWaitlist)
      .set({ notifiedAt: input.now })
      .where(
        and(
          eq(cityWaitlist.id, input.waitlistId),
          isNull(cityWaitlist.notifiedAt),
        ),
      ),
  ]);
};

/**
 * Record a failed attempt: retried after a minute, then after five, and failed for good on the
 * third attempt or at once when `permanent`. A notice failed for good leaves its entry owed.
 */
export const markCityWaitlistNotificationFailed = async (
  db: Db,
  input: { id: string; error: string; now: Date; permanent?: boolean },
): Promise<void> => {
  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  const final = sql`${input.permanent ? 1 : 0} = 1 OR attempts + 1 >= ${MAX_ATTEMPTS}`;
  await db
    .update(cityWaitlistNotifications)
    .set({
      attempts: sql`attempts + 1`,
      lastError: input.error,
      status: sql`CASE WHEN ${final} THEN 'failed' ELSE 'pending' END`,
      nextAttemptAt: sql`CASE WHEN ${final} THEN next_attempt_at ELSE ${nowSeconds} + CASE WHEN attempts = 0 THEN 60 ELSE 300 END END`,
      claimedAt: null,
      dispatchStartedAt: null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(cityWaitlistNotifications.id, input.id),
        eq(cityWaitlistNotifications.status, 'processing'),
      ),
    );
};
