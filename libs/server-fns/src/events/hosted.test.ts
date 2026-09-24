import { beforeEach, describe, expect, it } from 'vitest';

import {
  countHostedMeetups,
  createEvent,
  eventCloseouts,
  user,
  type Db,
} from '@founders-coffee/db';

import { listHostedEventPage } from './hosted.js';
import { baseEvent, nextId, setupDb } from './resolver.fixtures.js';

const DAY = 24 * 60 * 60 * 1000;
let seq = 0;

/**
 * A host nobody else in this file shares.
 *
 * The suite's `setupDb` leaves earlier tests' events in place, so each test hosts its own meetups
 * and its page holds nothing another test created.
 */
const freshHost = async (db: Db): Promise<string> => {
  const hostId = `usr_hosted_${String(++seq).padStart(9, '0')}`;
  await db
    .insert(user)
    .values({
      id: hostId,
      name: 'Hosted Test Host',
      email: `${hostId}@test.coffee`,
      role: 'host',
    })
    .onConflictDoNothing()
    .run();
  return hostId;
};

const meetup = async (
  db: Db,
  hostId: string,
  daysFromNow: number,
  outcome?: 'held' | 'did_not_happen',
): Promise<string> => {
  const eventId = nextId();
  await createEvent(db, {
    ...baseEvent(eventId, `hosted-${eventId}`),
    hostId,
    startsAt: new Date(Date.now() + daysFromNow * DAY),
  });
  if (outcome)
    await db
      .insert(eventCloseouts)
      .values({
        eventId,
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '1',
        outcome,
        submittedByUserId: hostId,
      })
      .run();
  return eventId;
};

const tagged = (page: Awaited<ReturnType<typeof listHostedEventPage>>) =>
  page.items.filter((item) => item.isOnRecord).map((item) => item.id);

describe('listHostedEventPage', () => {
  let db: Db;
  let hostId: string;

  beforeEach(async () => {
    db = await setupDb();
    hostId = await freshHost(db);
  });

  it('marks the meetups on the host’s record, and only those', async () => {
    const held = await meetup(db, hostId, -3, 'held');
    await meetup(db, hostId, -10, 'did_not_happen');
    await meetup(db, hostId, -17);
    await meetup(db, hostId, -731, 'held');
    await meetup(db, hostId, 5);

    const page = await listHostedEventPage(db, { hostId });

    expect(page.items).toHaveLength(5);
    expect(tagged(page)).toEqual([held]);
    expect(tagged(page)).toHaveLength(
      await countHostedMeetups(db, hostId, new Date()),
    );
  });

  it('marks each page by its own meetups', async () => {
    const newest = await meetup(db, hostId, -1, 'held');
    const middle = await meetup(db, hostId, -2, 'held');
    const oldest = await meetup(db, hostId, -3, 'held');

    const first = await listHostedEventPage(db, { hostId, limit: 2 });
    const second = await listHostedEventPage(db, {
      hostId,
      limit: 2,
      beforeStartsAt: first.nextCursor?.startsAt,
      beforeId: first.nextCursor?.id,
    });

    expect(tagged(first)).toEqual([newest, middle]);
    expect(tagged(second)).toEqual([oldest]);
    expect(second.total).toBe(3);
  });
});
