import { beforeEach, describe, expect, it } from 'vitest';

import type { Db } from './db.js';
import { eq } from './index.js';
import { cityWaitlist, cityWaitlistNotifications } from './schema.js';
import {
  deleteExpiredWaitlistEntries,
  insertWaitlistEntry,
} from './waitlist.js';
import { cancelCityWaitlistLaunch } from './waitlist-launch.js';
import {
  beginCityWaitlistNotificationDispatch,
  claimCityWaitlistNotifications,
  markCityWaitlistNotificationFailed,
} from './waitlist-notifications.js';
import {
  fanOutAlgiers,
  joinWaitlist,
  openRoundForNewMeetup,
  setupWaitlistDb,
} from './waitlist.fixtures.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const noticeRow = async (db: Db, noticeId: string) =>
  (
    await db
      .select()
      .from(cityWaitlistNotifications)
      .where(eq(cityWaitlistNotifications.id, noticeId))
  )[0];

describe('city waitlist notices', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupWaitlistDb();
  });

  it('claims each due notice once, then backs a failure off a minute, five, and gives up', async () => {
    await joinWaitlist(db, 'waiting@example.com');
    const { launchId } = await openRoundForNewMeetup(db);
    await fanOutAlgiers(db, launchId);
    let now = new Date();
    const claim = () =>
      claimCityWaitlistNotifications(db, { launchId, limit: 10, now });

    const [notice] = await claim();
    expect(await claim(), 'a claimed notice is nobody else’s').toHaveLength(0);

    for (const [attempt, backoffSeconds] of [
      [1, 60],
      [2, 300],
    ] as const) {
      await markCityWaitlistNotificationFailed(db, {
        id: notice.id,
        error: 'timeout',
        now,
      });
      const row = await noticeRow(db, notice.id);
      expect(row?.status).toBe('pending');
      expect(row?.attempts).toBe(attempt);
      expect(row?.nextAttemptAt.getTime()).toBe(
        Math.floor(now.getTime() / 1000) * 1000 + backoffSeconds * 1000,
      );
      expect(await claim(), 'not due before its back-off').toHaveLength(0);
      now = new Date(now.getTime() + backoffSeconds * 1000 + 1000);
      expect(await claim()).toHaveLength(1);
    }

    await markCityWaitlistNotificationFailed(db, {
      id: notice.id,
      error: 'timeout',
      now,
    });
    expect(await noticeRow(db, notice.id)).toMatchObject({
      status: 'failed',
      attempts: 3,
      lastError: 'timeout',
    });
  });

  it('refuses to start a send the meetup’s cancellation took back', async () => {
    await joinWaitlist(db, 'waiting@example.com');
    const { eventId, launchId } = await openRoundForNewMeetup(db);
    await fanOutAlgiers(db, launchId);
    const now = new Date();
    const [first] = await claimCityWaitlistNotifications(db, {
      launchId,
      limit: 10,
      now,
    });

    await cancelCityWaitlistLaunch(db, eventId, now);

    expect(
      await beginCityWaitlistNotificationDispatch(db, { id: first.id, now }),
    ).toBe(false);
  });

  it('deletes an entry twelve months after its notice, and keeps one still waiting', async () => {
    const now = new Date();
    const expired = await joinWaitlist(db, 'expired@example.com');
    const recent = await joinWaitlist(db, 'recent@example.com');
    const waiting = await joinWaitlist(db, 'waiting@example.com');
    await db
      .update(cityWaitlist)
      .set({ notifiedAt: new Date(now.getTime() - 366 * DAY_MS) })
      .where(eq(cityWaitlist.id, expired));
    await db
      .update(cityWaitlist)
      .set({ notifiedAt: new Date(now.getTime() - 300 * DAY_MS) })
      .where(eq(cityWaitlist.id, recent));
    await db
      .update(cityWaitlist)
      .set({ createdAt: new Date(now.getTime() - 900 * DAY_MS) })
      .where(eq(cityWaitlist.id, waiting));

    expect(await deleteExpiredWaitlistEntries(db, { now, limit: 10 })).toBe(1);

    const left = await db.select({ id: cityWaitlist.id }).from(cityWaitlist);
    expect(left.map((row) => row.id).sort()).toEqual([recent, waiting].sort());
  });

  it('keeps one entry per address, market and city', async () => {
    const entry = {
      email: 'twice@example.com',
      marketCode: 'DZ',
      cityCode: '1',
      locale: 'fr' as const,
    };

    expect(await insertWaitlistEntry(db, { id: 'wait_a', ...entry })).toEqual({
      status: 'joined',
    });
    expect(await insertWaitlistEntry(db, { id: 'wait_b', ...entry })).toEqual({
      status: 'already_waitlisted',
    });
    expect(
      await insertWaitlistEntry(db, {
        id: 'wait_c',
        ...entry,
        marketCode: 'EG',
      }),
      'the same city code in another market is another city',
    ).toEqual({ status: 'joined' });
  });
});
