import { describe, expect, it } from 'vitest';

import {
  cityWaitlist,
  cityWaitlistNotifications,
  eq,
  fanOutCityWaitlistLaunch,
} from '@founders-coffee/db';

import {
  processWaitlistLaunch,
  sweepExpiredWaitlistEntries,
  sweepWaitlistLaunches,
} from './waitlist-launch.js';
import {
  ALGIERS,
  makeDue,
  notifiedAt,
  noticesOf,
  publishMeetup,
  recordingDeps,
  recordingEmail,
  roundStatus,
  setupWaitlistDb,
  waitFor,
} from './waitlist-launch.fixtures.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('waitlist launch retries and recovery', () => {
  it('retries a refused send after a minute, then five, then leaves the entry owed to the next meetup', async () => {
    const db = await setupWaitlistDb();
    const bouncing = await waitFor(db, 'bounce@example.com');
    const meetup = await publishMeetup(db);
    const refusing = recordingEmail(['bounce@example.com']);
    const { deps, requeued } = recordingDeps(refusing.provider);

    await processWaitlistLaunch(db, meetup.message, deps);
    await makeDue(db, meetup.message.launchId);
    await processWaitlistLaunch(db, meetup.message, deps);
    await makeDue(db, meetup.message.launchId);
    await processWaitlistLaunch(db, meetup.message, deps);

    expect(requeued.map((entry) => entry.delaySeconds)).toEqual([60, 300]);
    expect(await noticesOf(db, meetup.message.launchId)).toMatchObject([
      { status: 'failed', attempts: 3, lastError: 'mailbox unavailable' },
    ]);
    expect(await roundStatus(db, meetup.message.launchId)).toBe('completed');
    expect(await notifiedAt(db, bouncing)).toBeNull();

    const next = await publishMeetup(db);
    const working = recordingEmail();
    await processWaitlistLaunch(
      db,
      next.message,
      recordingDeps(working.provider).deps,
    );
    expect(working.sent.map((message) => message.to)).toEqual([
      'bounce@example.com',
    ]);
  });

  it('retries a claim abandoned before sending, and never resends one that may have gone out', async () => {
    const db = await setupWaitlistDb();
    const unsent = await waitFor(db, 'unsent@example.com');
    const unconfirmed = await waitFor(db, 'unconfirmed@example.com');
    const meetup = await publishMeetup(db);
    const { launchId } = meetup.message;
    await fanOutCityWaitlistLaunch(db, {
      launchId,
      marketCode: ALGIERS.marketCode,
      cityCode: ALGIERS.cityCode,
      now: new Date(),
    });
    const abandoned = new Date(Date.now() - 20 * 60 * 1000);
    await db
      .update(cityWaitlistNotifications)
      .set({ status: 'processing', claimedAt: abandoned })
      .where(eq(cityWaitlistNotifications.waitlistId, unsent));
    await db
      .update(cityWaitlistNotifications)
      .set({
        status: 'processing',
        claimedAt: abandoned,
        dispatchStartedAt: abandoned,
      })
      .where(eq(cityWaitlistNotifications.waitlistId, unconfirmed));
    const email = recordingEmail();
    const { deps, requeued } = recordingDeps(email.provider);

    await processWaitlistLaunch(db, meetup.message, deps);

    expect(email.sent).toHaveLength(0);
    expect(requeued.map((entry) => entry.delaySeconds)).toEqual([60]);
    const byEntry = Object.fromEntries(
      (await noticesOf(db, launchId)).map((row) => [row.waitlistId, row]),
    );
    expect(byEntry[unconfirmed]).toMatchObject({
      status: 'failed',
      lastError: 'dispatch_unconfirmed',
    });
    expect(byEntry[unsent]).toMatchObject({
      status: 'pending',
      lastError: 'claim_expired',
    });

    await makeDue(db, launchId);
    await processWaitlistLaunch(db, meetup.message, deps);

    expect(email.sent.map((message) => message.to)).toEqual([
      'unsent@example.com',
    ]);
    expect(await roundStatus(db, launchId)).toBe('completed');
  });

  it('carries a round the queue never delivered from the recovery sweep', async () => {
    const db = await setupWaitlistDb();
    await waitFor(db, 'waiting@example.com', 'fr');
    const meetup = await publishMeetup(db);
    const email = recordingEmail();

    await sweepWaitlistLaunches(db, { email: email.provider });

    expect(email.sent.map((message) => message.to)).toEqual([
      'waiting@example.com',
    ]);
    expect(await roundStatus(db, meetup.message.launchId)).toBe('completed');
  });

  it('deletes the entries told over a year ago in the daily retention sweep', async () => {
    const db = await setupWaitlistDb();
    const expired = await waitFor(db, 'expired@example.com');
    const recent = await waitFor(db, 'recent@example.com');
    const waiting = await waitFor(db, 'waiting@example.com');
    await db
      .update(cityWaitlist)
      .set({ notifiedAt: new Date(Date.now() - 400 * DAY_MS) })
      .where(eq(cityWaitlist.id, expired));
    await db
      .update(cityWaitlist)
      .set({ notifiedAt: new Date(Date.now() - 30 * DAY_MS) })
      .where(eq(cityWaitlist.id, recent));

    expect(await sweepExpiredWaitlistEntries(db)).toBe(1);

    const left = await db.select({ id: cityWaitlist.id }).from(cityWaitlist);
    expect(left.map((row) => row.id).sort()).toEqual([recent, waiting].sort());
  });
});
