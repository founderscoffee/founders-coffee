import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createDb,
  createEvent,
  eq,
  events,
  eventRsvps,
  markets,
  scheduledNotifications,
  seed,
  user,
  type Db,
  type NewUser,
} from '@founders-coffee/db';

import { cancelRsvpResolver, createRsvpResolver } from './resolver.js';

const HOST_ID = 'usr_rsvpresolvehost';

const members: NewUser[] = Array.from({ length: 4 }, (_, i) => ({
  id: `usr_rr${i}`,
  name: `Resolver Member ${i}`,
  email: `rr${i}@resolve.test`,
  emailVerified: false,
  role: 'member' as const,
}));

let counter = 0;

const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .update(markets)
    .set({ state: 'active' })
    .where(eq(markets.code, 'DZ'))
    .run();
  await db
    .insert(user)
    .values([
      {
        id: HOST_ID,
        name: 'Resolver Host',
        email: 'host@resolve.test',
        emailVerified: false,
        role: 'host',
      },
      ...members,
    ])
    .onConflictDoNothing()
    .run();
  return db;
};

const seedEvent = async (
  db: Db,
  overrides: { status?: 'published' | 'draft' } = {},
): Promise<string> => {
  const n = ++counter;
  const id = `evt_rr${String(n).padStart(3, '0')}`;
  await createEvent(db, {
    id,
    slug: `resolver-rsvp-${n}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Resolver RSVP ${n}`,
    description: 'RSVP resolver fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    language: 'fr',
    status: overrides.status ?? 'published',
  });
  return id;
};

const state = async (db: Db, eventId: string) => {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  const attendees = await db
    .select()
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId));
  const notifications = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, eventId));
  return {
    counter: event?.rsvps ?? -1,
    attendees: attendees.length,
    notifications: notifications.length,
  };
};

describe('createRsvpResolver (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('returns event_not_found for an unknown event', async () => {
    const result = await createRsvpResolver(db, {
      eventId: 'evt_missing',
      userId: members[0].id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });

  it('returns event_not_available for an unpublished event', async () => {
    const eventId = await seedEvent(db, { status: 'draft' });
    const result = await createRsvpResolver(db, {
      eventId,
      userId: members[0].id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_available');
    expect((await state(db, eventId)).attendees).toBe(0);
  });

  it('takes a seat and enqueues notifications', async () => {
    const eventId = await seedEvent(db);
    const result = await createRsvpResolver(db, {
      eventId,
      userId: members[0].id,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('going');
    const after = await state(db, eventId);
    expect(after.counter).toBe(1);
    expect(after.attendees).toBe(1);
    expect(after.notifications).toBeGreaterThan(0);
  });

  it('returns typed event_not_found and writes nothing for a missing event', async () => {
    const result = await createRsvpResolver(db, {
      eventId: 'evt_never_existed',
      userId: members[0].id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });

  it('returns typed already_rsvpd for a repeat attempt', async () => {
    const eventId = await seedEvent(db);
    await createRsvpResolver(db, { eventId, userId: members[0].id });
    const before = await state(db, eventId);

    const result = await createRsvpResolver(db, {
      eventId,
      userId: members[0].id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('already_rsvpd');
    expect(await state(db, eventId)).toEqual(before);
  });

  it('returns already_rsvpd, never an untyped throw, for a concurrent duplicate', async () => {
    const eventId = await seedEvent(db);

    const results = await Promise.all([
      createRsvpResolver(db, { eventId, userId: members[0].id }),
      createRsvpResolver(db, { eventId, userId: members[0].id }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const rejected = results.find((r) => !r.ok);
    expect(rejected && !rejected.ok && rejected.error.code).toBe(
      'already_rsvpd',
    );
    const after = await state(db, eventId);
    expect(after.counter).toBe(1);
    expect(after.attendees).toBe(1);
  });

  it('does not enqueue notifications for a rejected attempt', async () => {
    const eventId = await seedEvent(db);
    await createRsvpResolver(db, { eventId, userId: members[0].id });
    const before = await state(db, eventId);

    await createRsvpResolver(db, { eventId, userId: members[0].id });

    expect((await state(db, eventId)).notifications).toBe(before.notifications);
  });
});

describe('cancelRsvpResolver (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('returns rsvp_not_found when there is nothing to cancel', async () => {
    const eventId = await seedEvent(db);
    const result = await cancelRsvpResolver(db, {
      eventId,
      userId: members[0].id,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('rsvp_not_found');
  });

  it('gives up the seat and lets the same member take it again', async () => {
    const eventId = await seedEvent(db);
    await createRsvpResolver(db, { eventId, userId: members[0].id });

    await cancelRsvpResolver(db, { eventId, userId: members[0].id });
    expect(await state(db, eventId)).toMatchObject({
      counter: 0,
      attendees: 0,
    });

    const retry = await createRsvpResolver(db, {
      eventId,
      userId: members[0].id,
    });
    expect(retry.ok).toBe(true);
    expect(await state(db, eventId)).toMatchObject({
      counter: 1,
      attendees: 1,
    });
  });
});
