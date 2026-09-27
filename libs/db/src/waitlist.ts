import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  notExists,
} from 'drizzle-orm';

import type { Locale, WaitlistJoinOutcome } from '@founders-coffee/core';

import type { Db } from './db.js';
import {
  cityWaitlist,
  cityWaitlistNotifications,
  type CityWaitlistRow,
} from './schema.js';

const LIVE_NOTICE_STATUSES = ['pending', 'processing', 'sent'] as const;

const WAITLIST_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Put an address on a city's waitlist, once per market and city.
 *
 * The composite UNIQUE(email, market_code, city_code) is the guard, as the insert's own conflict
 * target rather than an error to parse: a repeat changes no row and is answered
 * `already_waitlisted`, which the form shows as "already on the list". Parsing the driver's error
 * missed every repeat, because Drizzle wraps D1's message in its own and keeps the UNIQUE text on
 * the cause, so a second join failed as a server error.
 */
export const insertWaitlistEntry = async (
  db: Db,
  entry: {
    id: string;
    email: string;
    marketCode: string;
    cityCode: string;
    locale: Locale;
  },
): Promise<{ status: WaitlistJoinOutcome }> => {
  const result = await db
    .insert(cityWaitlist)
    .values({
      id: entry.id,
      email: entry.email,
      marketCode: entry.marketCode,
      cityCode: entry.cityCode,
      locale: entry.locale,
    })
    .onConflictDoNothing({
      target: [
        cityWaitlist.email,
        cityWaitlist.marketCode,
        cityWaitlist.cityCode,
      ],
    });
  return {
    status:
      ((result.meta?.changes ?? 0) as number) > 0
        ? 'joined'
        : 'already_waitlisted',
  };
};

/**
 * Count waitlist entries for a city (used by the empty-state UI to show demand signal,
 * and by the SEO layer to decide whether to lift `noindex`).
 */
export const countWaitlistByCity = async (
  db: Db,
  marketCode: string,
  cityCode: string,
): Promise<number> => {
  const rows = await db
    .select({ count: cityWaitlist.id })
    .from(cityWaitlist)
    .where(
      and(
        eq(cityWaitlist.marketCode, marketCode),
        eq(cityWaitlist.cityCode, cityCode),
      ),
    );
  return rows.length;
};

/**
 * The entries in a market's city still owed their notice, as a query to await or nest.
 *
 * Owed means never notified and holding no notice that is on its way or already sent. A notice that
 * failed for good, or was cancelled with its meetup, leaves the entry owed, so the next meetup in
 * the city tells them instead. The statuses match the partial unique index on the notifications,
 * which is what stops two rounds from both claiming one entry.
 */
export const waitingForCity = (db: Db, marketCode: string, cityCode: string) =>
  db
    .select()
    .from(cityWaitlist)
    .where(
      and(
        eq(cityWaitlist.marketCode, marketCode),
        eq(cityWaitlist.cityCode, cityCode),
        isNull(cityWaitlist.notifiedAt),
        notExists(
          db
            .select({ id: cityWaitlistNotifications.id })
            .from(cityWaitlistNotifications)
            .where(
              and(
                eq(cityWaitlistNotifications.waitlistId, cityWaitlist.id),
                inArray(cityWaitlistNotifications.status, [
                  ...LIVE_NOTICE_STATUSES,
                ]),
              ),
            ),
        ),
      ),
    );

/**
 * Find the waitlist entries a notice round for this city should write a notice for.
 */
export const findPendingWaitlistForCity = async (
  db: Db,
  marketCode: string,
  cityCode: string,
): Promise<readonly CityWaitlistRow[]> =>
  waitingForCity(db, marketCode, cityCode);

/**
 * Delete up to `limit` entries whose notice went out more than twelve months ago.
 *
 * The privacy policy keeps a waitlist email "until the launch notice, then 12 months". An entry
 * never notified is still waiting and stays. The query reads only through the partial index on
 * `notified_at`, the narrow, indexed daily sweep AGENTS.md §11.5 allows for retention (#106).
 */
export const deleteExpiredWaitlistEntries = async (
  db: Db,
  input: { now: Date; limit: number },
): Promise<number> => {
  const cutoff = new Date(input.now.getTime() - WAITLIST_RETENTION_MS);
  const result = await db.delete(cityWaitlist).where(
    inArray(
      cityWaitlist.id,
      db
        .select({ id: cityWaitlist.id })
        .from(cityWaitlist)
        .where(
          and(
            isNotNull(cityWaitlist.notifiedAt),
            lt(cityWaitlist.notifiedAt, cutoff),
          ),
        )
        .limit(input.limit),
    ),
  );
  return (result.meta?.changes ?? 0) as number;
};
