import { and, asc, eq, exists, inArray, sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import { insertChunks } from './d1-limits.js';
import type { Db } from './db.js';
import { findPendingWaitlistForCity, waitingForCity } from './waitlist.js';
import {
  cityWaitlistLaunches,
  cityWaitlistNotifications,
  type CityWaitlistLaunchRow,
} from './schema.js';

const toSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

/**
 * Open a notice round for a newly published meetup, if anybody in its city is still waiting.
 *
 * One statement, so the check and the write cannot be split by a concurrent join or round: the row
 * is written only while the city has an owed entry, and at most once per meetup. A meetup in a city
 * nobody waits for writes nothing, which keeps the queue and the recovery sweep out of the common
 * case.
 */
export const openCityWaitlistLaunch = async (
  db: Db,
  input: {
    id: string;
    eventId: string;
    marketCode: string;
    cityCode: string;
    now: Date;
  },
): Promise<{ written: boolean }> => {
  const result = await db.run(sql`
    INSERT INTO city_waitlist_launches
      (id, event_id, market_code, city_code, status, created_at)
    SELECT ${input.id}, ${input.eventId}, ${input.marketCode}, ${input.cityCode},
      'pending', ${toSeconds(input.now)}
    WHERE ${exists(waitingForCity(db, input.marketCode, input.cityCode))}
    ON CONFLICT DO NOTHING
  `);
  return { written: ((result.meta?.changes ?? 0) as number) > 0 };
};

/**
 * Write a pending notice for every entry the round's city still owes one, and return how many.
 *
 * Safe to repeat: an entry already holding a notice in this round, or a live one in any round, is
 * skipped by the unique indexes, so re-running it picks up only whoever joined since. The rows go
 * in chunks that stay under D1's bound-parameter limit, all in one batch.
 */
export const fanOutCityWaitlistLaunch = async (
  db: Db,
  input: { launchId: string; marketCode: string; cityCode: string; now: Date },
): Promise<number> => {
  const waiting = await findPendingWaitlistForCity(
    db,
    input.marketCode,
    input.cityCode,
  );
  const rows = waiting.map((entry) => ({
    id: id('wln'),
    launchId: input.launchId,
    waitlistId: entry.id,
    status: 'pending' as const,
    attempts: 0,
    nextAttemptAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
  }));
  const [first, ...rest] = insertChunks(cityWaitlistNotifications, rows).map(
    (chunk) =>
      db.insert(cityWaitlistNotifications).values(chunk).onConflictDoNothing(),
  );
  if (first) await db.batch([first, ...rest]);
  return rows.length;
};

/**
 * Read one notice round by its id.
 */
export const getCityWaitlistLaunch = async (
  db: Db,
  launchId: string,
): Promise<CityWaitlistLaunchRow | undefined> => {
  const rows = await db
    .select()
    .from(cityWaitlistLaunches)
    .where(eq(cityWaitlistLaunches.id, launchId))
    .limit(1);
  return rows[0];
};

/**
 * Close a meetup's open notice round because the meetup will not happen as announced.
 *
 * The notices not yet sent are cancelled, which leaves their entries owed to the next meetup in the
 * city; the ones already sent stay as the record of what went out. Both writes run in one batch
 * and each re-checks that the round is still pending, so a round that completes in the meantime is
 * left completed.
 */
export const cancelCityWaitlistLaunch = async (
  db: Db,
  eventId: string,
  now: Date = new Date(),
): Promise<void> => {
  const openRound = and(
    eq(cityWaitlistLaunches.eventId, eventId),
    eq(cityWaitlistLaunches.status, 'pending'),
  );
  await db.batch([
    db
      .update(cityWaitlistNotifications)
      .set({
        status: 'cancelled',
        claimedAt: null,
        dispatchStartedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          inArray(
            cityWaitlistNotifications.launchId,
            db
              .select({ id: cityWaitlistLaunches.id })
              .from(cityWaitlistLaunches)
              .where(openRound),
          ),
          inArray(cityWaitlistNotifications.status, ['pending', 'processing']),
        ),
      ),
    db
      .update(cityWaitlistLaunches)
      .set({ status: 'cancelled', cancelledAt: now })
      .where(openRound),
  ]);
};

/**
 * Mark a round completed once none of its notices is pending or in flight.
 */
export const completeCityWaitlistLaunchIfDrained = async (
  db: Db,
  launchId: string,
  now: Date = new Date(),
): Promise<boolean> => {
  const result = await db
    .update(cityWaitlistLaunches)
    .set({ status: 'completed', completedAt: now })
    .where(
      and(
        eq(cityWaitlistLaunches.id, launchId),
        eq(cityWaitlistLaunches.status, 'pending'),
        sql`NOT EXISTS (
          SELECT 1 FROM city_waitlist_notifications
          WHERE launch_id = ${launchId}
            AND status IN ('pending', 'processing')
        )`,
      ),
    );
  return ((result.meta?.changes ?? 0) as number) > 0;
};

/**
 * When a round's next pending notice is due, and how many of its notices are in flight.
 */
export const nextCityWaitlistAttempt = async (
  db: Db,
  launchId: string,
): Promise<{ nextAttemptAt: Date | null; inFlight: number }> => {
  const rows = await db
    .select({
      nextAttemptAt: sql<
        number | null
      >`min(CASE WHEN ${cityWaitlistNotifications.status} = 'pending' THEN ${cityWaitlistNotifications.nextAttemptAt} END)`,
      inFlight: sql<number>`count(CASE WHEN ${cityWaitlistNotifications.status} = 'processing' THEN 1 END)`,
    })
    .from(cityWaitlistNotifications)
    .where(eq(cityWaitlistNotifications.launchId, launchId));
  const next = rows[0]?.nextAttemptAt ?? null;
  return {
    nextAttemptAt: next === null ? null : new Date(next * 1000),
    inFlight: rows[0]?.inFlight ?? 0,
  };
};

/**
 * The oldest rounds still pending, for the recovery sweep.
 */
export const listPendingCityWaitlistLaunches = async (
  db: Db,
  limit: number,
): Promise<CityWaitlistLaunchRow[]> =>
  db
    .select()
    .from(cityWaitlistLaunches)
    .where(eq(cityWaitlistLaunches.status, 'pending'))
    .orderBy(asc(cityWaitlistLaunches.createdAt))
    .limit(limit);
