import { env } from 'cloudflare:workers';
import { eq, sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import { createEvent, getEvent } from './events.js';
import { createDb, seed, user, type Db, type NewUser } from './index.js';
import { createRsvp } from './rsvps.js';
import { eventRsvps } from './schema.js';

export const HOST_ID = 'usr_rsvphost';

export const members: NewUser[] = Array.from({ length: 6 }, (_, i) => ({
  id: `usr_rsvpm${i}`,
  name: `Member ${i}`,
  email: `member${i}@rsvp.test`,
  emailVerified: false,
  role: 'member' as const,
}));

let counter = 0;

export const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .insert(user)
    .values([
      {
        id: HOST_ID,
        name: 'RSVP Host',
        email: 'host@rsvp.test',
        emailVerified: false,
        role: 'host',
      },
      ...members,
    ])
    .onConflictDoNothing()
    .run();
  return db;
};

export const seedEvent = async (
  db: Db,
  startsAt: Date = new Date('2099-01-15T18:00:00Z'),
): Promise<string> => {
  const n = ++counter;
  const eventId = id('evt');
  await createEvent(db, {
    id: eventId,
    slug: `rsvp-fixture-${n}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `RSVP fixture ${n}`,
    description: 'RSVP behaviour fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt,
    language: 'fr',
    status: 'published',
  });
  return eventId;
};

/**
 * Move an event's start relative to the database's own clock.
 *
 * The freeze compares against `unixepoch()` inside the statement, so a test cannot reach it by
 * choosing a JavaScript date — it has to move the row. Seconds rather than a fixed timestamp keeps
 * the boundary meaningful however long the suite takes to reach this line.
 */
export const setStartOffset = async (
  db: Db,
  eventId: string,
  seconds: number,
): Promise<void> => {
  await db.run(
    sql`UPDATE events SET starts_at = unixepoch() + ${seconds} WHERE id = ${eventId}`,
  );
};

/** The denormalized counter and the real attendee rows, which must always agree. */
export const counters = async (
  db: Db,
  eventId: string,
): Promise<{ counter: number; attendees: number }> => {
  const event = await getEvent(db, eventId);
  const rows = await db
    .select()
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId));
  return { counter: event?.rsvps ?? -1, attendees: rows.length };
};

export const fill = async (
  db: Db,
  eventId: string,
  howMany: number,
): Promise<void> => {
  for (let i = 0; i < howMany; i++) {
    await createRsvp(db, {
      id: id('rsv'),
      eventId,
      userId: members[i].id,
    });
  }
};

export const captureError = async (
  run: () => Promise<unknown>,
): Promise<unknown> => {
  try {
    await run();
    return null;
  } catch (error) {
    return error;
  }
};
