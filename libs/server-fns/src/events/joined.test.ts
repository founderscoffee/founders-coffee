import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import { createRsvp, user, type Db } from '@founders-coffee/db';

import { listJoinedEventPage } from './joined.js';
import { createTestEvent, setupDb } from './resolver.fixtures.js';

let seq = 0;

/**
 * A member nobody else in this file shares.
 *
 * The suite's `setupDb` does not clear RSVPs between tests, so a shared member accumulates every
 * gathering every earlier test joined and the totals drift upward. Giving each test its own member
 * isolates it without reaching into a fixture the other event suites depend on.
 */
const freshMember = async (db: Db): Promise<string> => {
  const userId = `usr_joined_${String(++seq).padStart(9, '0')}`;
  await db
    .insert(user)
    .values({
      id: userId,
      name: 'Joined Member',
      email: `${userId}@test.coffee`,
    })
    .onConflictDoNothing()
    .run();
  return userId;
};

const joinNewEvent = async (db: Db, userId: string) => {
  const event = await createTestEvent(db);
  await createRsvp(db, { id: id('rsv'), eventId: event.id, userId });
  return event.id;
};

describe('listJoinedEventPage', () => {
  let db: Db;
  let member: string;

  beforeEach(async () => {
    db = await setupDb();
    member = await freshMember(db);
  });

  it('reports the total beside the page, not the page length', async () => {
    for (let index = 0; index < 3; index++) await joinNewEvent(db, member);

    const page = await listJoinedEventPage(db, { userId: member, limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(3);
  });

  it('offers a cursor only while there is another page', async () => {
    await joinNewEvent(db, member);

    const page = await listJoinedEventPage(db, { userId: member, limit: 2 });

    expect(page.nextCursor).toBeNull();
    expect(page.total).toBe(1);
  });

  it('walks every joined gathering without repeating one', async () => {
    const created: string[] = [];
    for (let index = 0; index < 3; index++)
      created.push(await joinNewEvent(db, member));

    const seen: string[] = [];
    let cursor: { startsAt: number; id: string } | null = null;
    do {
      const page: Awaited<ReturnType<typeof listJoinedEventPage>> =
        await listJoinedEventPage(db, {
          userId: member,
          limit: 1,
          beforeStartsAt: cursor?.startsAt,
          beforeId: cursor?.id,
        });
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
    expect([...seen].sort()).toEqual([...created].sort());
  });

  it('answers for the member it was asked about and nobody else', async () => {
    await joinNewEvent(db, member);
    const stranger = await freshMember(db);

    const mine = await listJoinedEventPage(db, { userId: member });
    const theirs = await listJoinedEventPage(db, { userId: stranger });

    expect(mine.total).toBe(1);
    expect(theirs.total).toBe(0);
    expect(theirs.items).toEqual([]);
  });

  it('is empty rather than absent for a member who has joined nothing', async () => {
    const page = await listJoinedEventPage(db, { userId: id('usr') });

    expect(page).toMatchObject({ items: [], total: 0, nextCursor: null });
  });

  it('carries the city name each item is shown with', async () => {
    await joinNewEvent(db, member);

    const page = await listJoinedEventPage(db, { userId: member });

    expect(page.items[0]).toHaveProperty('cityName');
  });
});
