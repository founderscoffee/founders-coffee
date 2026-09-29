import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { eq } from './index.js';
import { cityWaitlistLaunches, cityWaitlistNotifications } from './schema.js';
import { waitingForCity } from './waitlist.js';
import {
  cancelCityWaitlistLaunch,
  completeCityWaitlistLaunchIfDrained,
  openCityWaitlistLaunch,
} from './waitlist-launch.js';
import {
  claimCityWaitlistNotifications,
  markCityWaitlistNotificationFailed,
  markCityWaitlistNotificationSent,
} from './waitlist-notifications.js';
import {
  fanOutAlgiers,
  joinWaitlist,
  openRoundForNewMeetup,
  setupWaitlistDb,
} from './waitlist.fixtures.js';

const noticesOf = (db: Db, launchId: string) =>
  db
    .select()
    .from(cityWaitlistNotifications)
    .where(eq(cityWaitlistNotifications.launchId, launchId));

const roundStatus = async (db: Db, launchId: string) =>
  (
    await db
      .select()
      .from(cityWaitlistLaunches)
      .where(eq(cityWaitlistLaunches.id, launchId))
  )[0]?.status;

describe('city waitlist notice rounds', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupWaitlistDb();
  });

  it('opens a round only while somebody in the meetup’s city is still waiting', async () => {
    expect((await openRoundForNewMeetup(db)).written).toBe(false);

    await joinWaitlist(db, 'oran@example.com', { cityCode: '2' });
    await joinWaitlist(db, 'cairo@example.com', { marketCode: 'EG' });
    expect((await openRoundForNewMeetup(db)).written).toBe(false);

    await joinWaitlist(db, 'algiers@example.com');
    const round = await openRoundForNewMeetup(db);
    expect(round.written).toBe(true);

    const again = await openCityWaitlistLaunch(db, {
      id: id('wll'),
      eventId: round.eventId,
      marketCode: 'DZ',
      cityCode: '1',
      now: new Date(),
    });
    expect(again.written, 'one round per meetup').toBe(false);
  });

  it('writes one notice per waiting entry beyond the 100 values D1 binds per statement', async () => {
    for (let index = 0; index < 25; index += 1)
      await joinWaitlist(db, `waiting${index}@example.com`);
    const { launchId } = await openRoundForNewMeetup(db);

    expect(await fanOutAlgiers(db, launchId)).toBe(25);
    expect(await fanOutAlgiers(db, launchId), 'a repeat writes nothing').toBe(
      0,
    );

    await joinWaitlist(db, 'late@example.com');
    expect(await fanOutAlgiers(db, launchId)).toBe(1);
    expect(await noticesOf(db, launchId)).toHaveLength(26);
  });

  it('owes the next meetup to an entry whose notice failed, never to one already told', async () => {
    const told = await joinWaitlist(db, 'told@example.com');
    const bounced = await joinWaitlist(db, 'bounced@example.com');
    const first = await openRoundForNewMeetup(db);
    await fanOutAlgiers(db, first.launchId);
    const now = new Date();
    for (const notice of await claimCityWaitlistNotifications(db, {
      launchId: first.launchId,
      limit: 10,
      now,
    })) {
      if (notice.waitlistId === told)
        await markCityWaitlistNotificationSent(db, {
          id: notice.id,
          waitlistId: told,
          now,
        });
      else
        await markCityWaitlistNotificationFailed(db, {
          id: notice.id,
          error: 'bounced',
          now,
          permanent: true,
        });
    }
    expect(await completeCityWaitlistLaunchIfDrained(db, first.launchId)).toBe(
      true,
    );

    const second = await openRoundForNewMeetup(db);
    expect(second.written).toBe(true);
    expect(await fanOutAlgiers(db, second.launchId)).toBe(1);
    expect(
      (await noticesOf(db, second.launchId)).map((row) => row.waitlistId),
    ).toEqual([bounced]);
  });

  it('cancels what is unsent when the meetup is called off, and leaves those entries waiting', async () => {
    const sent = await joinWaitlist(db, 'sent@example.com');
    const inFlight = await joinWaitlist(db, 'in-flight@example.com');
    const queued = await joinWaitlist(db, 'queued@example.com');
    const round = await openRoundForNewMeetup(db);
    await fanOutAlgiers(db, round.launchId);
    const now = new Date();
    for (const notice of await claimCityWaitlistNotifications(db, {
      launchId: round.launchId,
      limit: 10,
      now,
    })) {
      if (notice.waitlistId === sent)
        await markCityWaitlistNotificationSent(db, {
          id: notice.id,
          waitlistId: sent,
          now,
        });
      if (notice.waitlistId === queued)
        await markCityWaitlistNotificationFailed(db, {
          id: notice.id,
          error: 'timeout',
          now,
        });
    }

    await cancelCityWaitlistLaunch(db, round.eventId, now);

    expect(await roundStatus(db, round.launchId)).toBe('cancelled');
    const statuses = Object.fromEntries(
      (await noticesOf(db, round.launchId)).map((row) => [
        row.waitlistId,
        row.status,
      ]),
    );
    expect(statuses).toEqual({
      [sent]: 'sent',
      [inFlight]: 'cancelled',
      [queued]: 'cancelled',
    });
    expect(
      (await waitingForCity(db, 'DZ', '1')).map((entry) => entry.id).sort(),
    ).toEqual([inFlight, queued].sort());
  });

  it('leaves a completed round completed when its meetup is cancelled afterwards', async () => {
    await joinWaitlist(db, 'told@example.com');
    const round = await openRoundForNewMeetup(db);
    await fanOutAlgiers(db, round.launchId);
    const now = new Date();
    const [notice] = await claimCityWaitlistNotifications(db, {
      launchId: round.launchId,
      limit: 10,
      now,
    });
    await markCityWaitlistNotificationSent(db, {
      id: notice.id,
      waitlistId: notice.waitlistId,
      now,
    });
    expect(
      await completeCityWaitlistLaunchIfDrained(db, round.launchId, now),
    ).toBe(true);

    await cancelCityWaitlistLaunch(db, round.eventId, now);

    expect(await roundStatus(db, round.launchId)).toBe('completed');
    expect((await noticesOf(db, round.launchId))[0]?.status).toBe('sent');
  });
});
