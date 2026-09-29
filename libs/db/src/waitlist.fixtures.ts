import { id, type Locale } from '@founders-coffee/core';

import type { Db } from './db.js';
import { futureEvent, setupDb } from './operations.fixtures.js';
import {
  cityWaitlist,
  cityWaitlistLaunches,
  cityWaitlistNotifications,
} from './schema.js';
import { insertWaitlistEntry } from './waitlist.js';
import {
  fanOutCityWaitlistLaunch,
  openCityWaitlistLaunch,
} from './waitlist-launch.js';

/**
 * A database with no waitlist entries, rounds or notices left over from another test in the file.
 */
export const setupWaitlistDb = async (): Promise<Db> => {
  const db = await setupDb();
  await db.delete(cityWaitlistNotifications).run();
  await db.delete(cityWaitlistLaunches).run();
  await db.delete(cityWaitlist).run();
  return db;
};

/**
 * Put an address on a city's waitlist, Algiers unless told otherwise, and return the entry's id.
 */
export const joinWaitlist = async (
  db: Db,
  email: string,
  where: { marketCode?: string; cityCode?: string; locale?: Locale } = {},
): Promise<string> => {
  const entryId = id('wait');
  await insertWaitlistEntry(db, {
    id: entryId,
    email,
    marketCode: where.marketCode ?? 'DZ',
    cityCode: where.cityCode ?? '1',
    locale: where.locale ?? 'ar',
  });
  return entryId;
};

/**
 * Publish a meetup in Algiers and try to open its notice round.
 */
export const openRoundForNewMeetup = async (
  db: Db,
): Promise<{ eventId: string; launchId: string; written: boolean }> => {
  const eventId = await futureEvent(db);
  const launchId = id('wll');
  const { written } = await openCityWaitlistLaunch(db, {
    id: launchId,
    eventId,
    marketCode: 'DZ',
    cityCode: '1',
    now: new Date(),
  });
  return { eventId, launchId, written };
};

/**
 * Write the notices an Algiers round owes, and return how many were owed.
 */
export const fanOutAlgiers = (db: Db, launchId: string): Promise<number> =>
  fanOutCityWaitlistLaunch(db, {
    launchId,
    marketCode: 'DZ',
    cityCode: '1',
    now: new Date(),
  });
