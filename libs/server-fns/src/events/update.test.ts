import { describe, expect, it } from 'vitest';

import {
  accountPreferences,
  createRsvp,
  eq,
  events,
  getEvent,
  listPendingNotifications,
  user,
  type Db,
  type Event,
} from '@founders-coffee/db';
import { eventUpdateSchema } from '@founders-coffee/domain';

import { enqueueRsvpNotifications } from '../notifications/producer.js';
import { updateEventResolver } from './update.js';
import { createEventResolver } from './resolver.js';
import {
  createInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

const GUEST_ID = 'usr_update_guest01';
const START = new Date('2099-01-15T18:00:00Z').getTime();
const END = new Date('2099-01-15T19:00:00Z').getTime();

const inviteGuest = async (db: Db, event: Event) => {
  const eventId = event.id;
  await db
    .insert(user)
    .values({
      id: GUEST_ID,
      name: 'Update Guest',
      email: 'update-guest@test.coffee',
      emailVerified: true,
      role: 'member',
    })
    .onConflictDoNothing()
    .run();
  await db
    .insert(accountPreferences)
    .values({ userId: GUEST_ID })
    .onConflictDoNothing();
  await createRsvp(db, { id: `rsv_u_${eventId}`, eventId, userId: GUEST_ID });
  await enqueueRsvpNotifications(db, {
    eventId,
    userId: GUEST_ID,
    eventTitle: event.title,
    eventSlug: event.slug,
    marketCode: event.marketCode,
    startsAt: event.startsAt,
    venue: event.venue,
  });
};

const hostAnEvent = async (db: Db): Promise<Event> => {
  const result = await createEventResolver(
    db,
    testMapProvider,
    TEST_HOST_ID,
    createInput(),
  );
  if (!result.ok) throw new Error('fixture event was not created');
  return result.data;
};

const editOf = (event: Event, overrides: Record<string, unknown> = {}) =>
  eventUpdateSchema.parse({
    expectedVersion: event.version,
    title: event.title,
    description: event.description,
    venueName: event.venue,
    venueAddress: event.venueAddress ?? '12 Rue des Entrepreneurs, Alger',
    latitude: event.latitude ?? 36.7538,
    longitude: event.longitude ?? 3.0588,
    startsAt: START,
    endsAt: END,
    language: event.language,
    ...overrides,
  });

const apply = (db: Db, event: Event, overrides: Record<string, unknown> = {}) =>
  updateEventResolver(db, testMapProvider, {
    eventId: event.id,
    actorId: TEST_HOST_ID,
    input: editOf(event, overrides),
  });

const pendingFor = async (db: Db, eventId: string, templateKey: string) => {
  const rows = await listPendingNotifications(db, {
    now: new Date('2099-01-14T18:00:00Z'),
    limit: 50,
  });
  return rows.filter(
    (row) => row.eventId === eventId && row.templateKey === templateKey,
  );
};

describe('who may edit a published meetup', () => {
  it('refuses a caller who does not host it', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    const result = await updateEventResolver(db, testMapProvider, {
      eventId: event.id,
      actorId: 'usr_somebody_else',
      input: editOf(event, { title: 'Taken over' }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_host');
    expect((await getEvent(db, event.id))?.title).toBe(event.title);
  });

  it('refuses an edit to a meetup that was called off', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await db
      .update(events)
      .set({ status: 'cancelled' })
      .where(eq(events.id, event.id))
      .run();

    const result = await apply(db, event, { title: 'Back from the dead' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_is_cancelled');
  });
});

describe('an edit built from a stale page', () => {
  it('is refused rather than applied over the newer one', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    const first = await apply(db, event, { title: 'First writer wins' });
    expect(first.ok).toBe(true);

    const second = await apply(db, event, { title: 'Second writer loses' });

    expect(
      second.ok,
      'the second save carries the version the first one superseded, so it describes a row that no longer exists',
    ).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('event_conflict');
    expect((await getEvent(db, event.id))?.title).toBe('First writer wins');
  });

  it('moves the version on every accepted edit', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    const result = await apply(db, event, { title: 'Renamed once' });

    expect(result.ok).toBe(true);
    expect((await getEvent(db, event.id))?.version).toBe(event.version + 1);
  });
});

describe('what an edit leaves alone', () => {
  it('keeps the slug that every already-shared link points at', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    await apply(db, event, { title: 'A completely different title' });

    expect(
      (await getEvent(db, event.id))?.slug,
      'regenerating the slug from a corrected title 404s every link the host already sent',
    ).toBe(event.slug);
  });

  it('keeps the bookings, so nobody loses their seat over a typo', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = (await getEvent(db, event.id))?.rsvps;

    await apply(db, event, { title: 'Corrected title' });

    expect((await getEvent(db, event.id))?.rsvps).toBe(before);
  });
});

describe('telling people when the time moves', () => {
  it('says nothing to anyone when only the wording changed', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);

    const result = await apply(db, event, { title: 'Just a better title' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rescheduled).toBe(false);
      expect(result.data.notified).toBe(0);
    }
    expect(await pendingFor(db, event.id, 'event_rescheduled')).toHaveLength(0);
  });

  it('tells everyone still going when the start moves', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);

    const result = await apply(db, event, {
      startsAt: START + 3_600_000,
      endsAt: END + 3_600_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rescheduled).toBe(true);
      expect(result.data.notified).toBe(1);
    }
    const notices = await pendingFor(db, event.id, 'event_rescheduled');
    expect(notices).toHaveLength(1);
    expect(
      notices[0]?.userId,
      'the host already knows what they just did',
    ).toBe(GUEST_ID);
  });

  it('does not confirm a booking the attendee made weeks ago', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = await pendingFor(db, event.id, 'rsvp_confirmation');

    await apply(db, event, {
      startsAt: START + 86_400_000,
      endsAt: END + 86_400_000,
    });

    expect(
      await pendingFor(db, event.id, 'rsvp_confirmation'),
      're-arming the reminders must not re-send the confirmation: the attendee booked long ago, and the reschedule notice is already telling them the one thing that changed',
    ).toHaveLength(before.length);
  });

  it('rewrites the reminders so none of them still describes the old time', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = await pendingFor(db, event.id, 'reminder_24h');
    expect(before.length).toBeGreaterThan(0);

    await apply(db, event, {
      startsAt: START + 86_400_000,
      endsAt: END + 86_400_000,
    });

    const after = await pendingFor(db, event.id, 'reminder_24h');
    expect(
      after.map((row) => row.id),
      'a reminder queued against the old start would arrive early, describing a time that is no longer true',
    ).not.toEqual(before.map((row) => row.id));
  });
});
