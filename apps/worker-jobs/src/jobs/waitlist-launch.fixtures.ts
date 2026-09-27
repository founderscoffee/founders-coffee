import { env } from 'cloudflare:test';

import {
  AppError,
  err,
  id,
  ok,
  type WaitlistLaunchDueMessage,
} from '@founders-coffee/core';
import {
  and,
  cityWaitlist,
  cityWaitlistLaunches,
  cityWaitlistNotifications,
  createDb,
  createEvent,
  eq,
  events,
  insertWaitlistEntry,
  openCityWaitlistLaunch,
  seed,
  user,
  type Db,
} from '@founders-coffee/db';
import type { EmailProvider } from '@founders-coffee/email';
import type { Locale } from '@founders-coffee/i18n';

import type { WaitlistLaunchDeps } from './waitlist-launch.js';

const HOST_ID = 'usr_waitlist_test';

export const ALGIERS = { marketCode: 'DZ', stateCode: '16', cityCode: '556' };
export const CAIRO = { marketCode: 'EG', stateCode: '1', cityCode: '397' };

type City = typeof ALGIERS;

/**
 * A database with the dev seed, one host, and no waitlist state left over from another test.
 */
export const setupWaitlistDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db.delete(cityWaitlistNotifications).run();
  await db.delete(cityWaitlistLaunches).run();
  await db.delete(cityWaitlist).run();
  await db.delete(events).where(eq(events.hostId, HOST_ID)).run();
  await db
    .insert(user)
    .values({
      id: HOST_ID,
      name: 'Waitlist host',
      email: 'waitlist-host@test.coffee',
      role: 'host',
    })
    .onConflictDoNothing()
    .run();
  return db;
};

/**
 * Put an address on a city's waitlist, Algiers unless told otherwise, and return the entry's id.
 */
export const waitFor = async (
  db: Db,
  email: string,
  locale: Locale = 'ar',
  city: City = ALGIERS,
): Promise<string> => {
  const entryId = id('wait');
  await insertWaitlistEntry(db, {
    id: entryId,
    email,
    marketCode: city.marketCode,
    cityCode: city.cityCode,
    locale,
  });
  return entryId;
};

/**
 * Publish a meetup, open its notice round, and return the queue message that announces it.
 */
export const publishMeetup = async (
  db: Db,
  options: {
    city?: City;
    title?: string;
    status?: 'published' | 'cancelled';
    startsAt?: Date;
  } = {},
): Promise<{
  eventId: string;
  slug: string;
  message: WaitlistLaunchDueMessage;
}> => {
  const city = options.city ?? ALGIERS;
  const eventId = id('evt');
  const slug = `waitlist-${eventId}`;
  await createEvent(db, {
    id: eventId,
    slug,
    hostId: HOST_ID,
    ...city,
    title: options.title ?? 'Founders morning',
    description: 'A local meetup.',
    venue: 'Founders Café',
    startsAt: options.startsAt ?? new Date('2099-01-15T18:00:00Z'),
    language: 'ar',
    status: options.status ?? 'published',
  });
  const launchId = id('wll');
  await openCityWaitlistLaunch(db, {
    id: launchId,
    eventId,
    marketCode: city.marketCode,
    cityCode: city.cityCode,
    now: new Date(),
  });
  return {
    eventId,
    slug,
    message: { kind: 'waitlist_launch_due', launchId, eventId },
  };
};

/**
 * An email provider that records what it sends and refuses the addresses it is given.
 */
export const recordingEmail = (refuse: readonly string[] = []) => {
  const sent: { to: string; subject: string; html: string; text: string }[] =
    [];
  const provider: EmailProvider = {
    name: 'recording-email',
    send: async (input) => {
      const to = String(input.to);
      if (refuse.includes(to))
        return err(new AppError('email_failed', 'mailbox unavailable'));
      sent.push({
        to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? '',
      });
      return ok({ messageId: `message-${sent.length}` });
    },
  };
  return { provider, sent };
};

/**
 * Waitlist dependencies that record each hand-back to the queue instead of sending it.
 */
export const recordingDeps = (email: EmailProvider) => {
  const requeued: {
    message: WaitlistLaunchDueMessage;
    delaySeconds: number;
  }[] = [];
  const deps: WaitlistLaunchDeps = {
    email,
    requeue: async (message, delaySeconds) => {
      requeued.push({ message, delaySeconds });
    },
  };
  return { deps, requeued };
};

/**
 * The status of a notice round.
 */
export const roundStatus = async (
  db: Db,
  launchId: string,
): Promise<string | undefined> =>
  (
    await db
      .select()
      .from(cityWaitlistLaunches)
      .where(eq(cityWaitlistLaunches.id, launchId))
  )[0]?.status;

/**
 * The notices of a round, one per entry.
 */
export const noticesOf = (db: Db, launchId: string) =>
  db
    .select()
    .from(cityWaitlistNotifications)
    .where(eq(cityWaitlistNotifications.launchId, launchId));

/**
 * Bring a round's backed-off notices due now, as if their back-off had passed.
 */
export const makeDue = (db: Db, launchId: string) =>
  db
    .update(cityWaitlistNotifications)
    .set({ nextAttemptAt: new Date(Date.now() - 1000) })
    .where(
      and(
        eq(cityWaitlistNotifications.launchId, launchId),
        eq(cityWaitlistNotifications.status, 'pending'),
      ),
    );

/**
 * When an entry was told, or null while it is still waiting.
 */
export const notifiedAt = async (
  db: Db,
  entryId: string,
): Promise<Date | null | undefined> =>
  (await db.select().from(cityWaitlist).where(eq(cityWaitlist.id, entryId)))[0]
    ?.notifiedAt;
