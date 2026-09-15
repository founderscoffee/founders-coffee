import { and, eq, isNull } from 'drizzle-orm';

import type { Locale } from '@founders-coffee/core';

import type { Db } from './db.js';
import { cityWaitlist, type CityWaitlistRow } from './schema.js';

/**
 * Insert a waitlist entry. The composite UNIQUE(email, city_code) is the real guard —
 * same email can waitlist multiple cities (one row each), but never the same city twice.
 *
 * Returns:
 * - `{ status: 'joined' }` on success
 * - `{ status: 'already_waitlisted' }` if the UNIQUE constraint fires (idempotent — the user
 *   already joined this city's waitlist; not an error, just a no-op signal)
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
): Promise<{ status: 'joined' | 'already_waitlisted' }> => {
  try {
    await db.insert(cityWaitlist).values({
      id: entry.id,
      email: entry.email,
      marketCode: entry.marketCode,
      cityCode: entry.cityCode,
      locale: entry.locale,
    });
    return { status: 'joined' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE') && message.includes('email_city')) {
      return { status: 'already_waitlisted' };
    }
    throw error;
  }
};

/**
 * Count waitlist entries for a city (used by the empty-state UI to show demand signal,
 * and by the SEO layer to decide whether to lift `noindex`).
 */
export const countWaitlistByCity = async (
  db: Db,
  cityCode: string,
): Promise<number> => {
  const rows = await db
    .select({ count: cityWaitlist.id })
    .from(cityWaitlist)
    .where(eq(cityWaitlist.cityCode, cityCode));
  return rows.length;
};

/**
 * Find all pending (not-yet-notified) waitlist entries for a city — used by the
 * reverse loop when a host creates the first event in a city (out of scope for this
 * plan; documented for the follow-up).
 */
export const findPendingWaitlistForCity = async (
  db: Db,
  cityCode: string,
): Promise<readonly CityWaitlistRow[]> => {
  return db
    .select()
    .from(cityWaitlist)
    .where(
      and(eq(cityWaitlist.cityCode, cityCode), isNull(cityWaitlist.notifiedAt)),
    );
};
