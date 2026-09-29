import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  cityWaitlist,
  cityWaitlistLaunches,
  cityWaitlistNotifications,
  eq,
  fanOutCityWaitlistLaunch,
  insertWaitlistEntry,
  type Db,
} from '@founders-coffee/db';

import { withRequestContext } from '../request-context.js';
import { cancelEventResolver } from './cancel.js';
import { createEventWithTelemetry } from './create.js';
import {
  createInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

const publish = async (db: Db, title: string) => {
  const result = await withRequestContext(() =>
    createEventWithTelemetry(
      db,
      testMapProvider,
      null,
      TEST_HOST_ID,
      createInput({ title }),
    ),
  );
  if (!result.ok) throw result.error;
  return result.data;
};

const roundsOf = (db: Db, eventId: string) =>
  db
    .select()
    .from(cityWaitlistLaunches)
    .where(eq(cityWaitlistLaunches.eventId, eventId));

const waitInAlgiers = (db: Db, email: string) =>
  insertWaitlistEntry(db, {
    id: id('wait'),
    email,
    marketCode: 'DZ',
    cityCode: '1',
    locale: 'fr',
  });

describe('a new meetup and its city’s waitlist', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await db.delete(cityWaitlistNotifications).run();
    await db.delete(cityWaitlistLaunches).run();
    await db.delete(cityWaitlist).run();
  });

  it('opens a notice round when somebody waits for the city, and nothing when nobody does', async () => {
    const unawaited = await publish(db, 'Nobody waits for this one');
    expect(await roundsOf(db, unawaited.id)).toHaveLength(0);

    await waitInAlgiers(db, 'waiting@example.com');
    const awaited = await publish(db, 'Somebody waits for this one');

    expect(await roundsOf(db, awaited.id)).toMatchObject([
      { status: 'pending', marketCode: 'DZ', cityCode: '1' },
    ]);
  });

  it('closes the round and its unsent notices when the host cancels the meetup', async () => {
    await waitInAlgiers(db, 'waiting@example.com');
    const meetup = await publish(db, 'Called off before the notice');
    const [round] = await roundsOf(db, meetup.id);
    await fanOutCityWaitlistLaunch(db, {
      launchId: round.id,
      marketCode: 'DZ',
      cityCode: '1',
      now: new Date(),
    });

    const cancelled = await cancelEventResolver(db, {
      eventId: meetup.id,
      actorId: TEST_HOST_ID,
    });

    expect(cancelled.ok).toBe(true);
    expect((await roundsOf(db, meetup.id))[0]?.status).toBe('cancelled');
    const notices = await db
      .select()
      .from(cityWaitlistNotifications)
      .where(eq(cityWaitlistNotifications.launchId, round.id));
    expect(notices.map((notice) => notice.status)).toEqual(['cancelled']);
  });
});
