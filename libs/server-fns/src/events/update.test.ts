import { describe, expect, it } from 'vitest';

import { eq, events, getEvent } from '@founders-coffee/db';
import { eventUpdateSchema } from '@founders-coffee/domain';

import { updateEventResolver } from './update.js';
import {
  createTestEvent,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';
import {
  apply,
  editOf,
  END,
  hostAnEvent,
  inviteGuest,
  START,
} from './update.fixtures.js';

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

describe('an event that never recorded a venue point', () => {
  it('can still have its title corrected', async () => {
    const db = await setupDb();
    const { id } = await createTestEvent(db);
    const stored = await getEvent(db, id);
    if (!stored) throw new Error('fixture event missing');
    expect(
      stored.latitude,
      'most rows predate venue coordinates, so this is the ordinary case rather than an edge one',
    ).toBeNull();

    const result = await apply(db, stored, { title: 'Corrected title' });

    expect(result.ok).toBe(true);
    expect((await getEvent(db, id))?.title).toBe('Corrected title');
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

describe('moving the venue point', () => {
  it('refuses a point that resolves to another city', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    const result = await updateEventResolver(db, testMapProvider, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
      input: eventUpdateSchema.parse({
        expectedVersion: event.version,
        title: event.title,
        description: event.description,
        venueName: event.venue,
        latitude: 36.8008,
        longitude: 3.1008,
        startsAt: START,
        endsAt: END,
        language: event.language,
      }),
    });

    expect(
      result.ok,
      'people found this gathering in their own city; moving it elsewhere is a different meetup wearing the same RSVPs',
    ).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_city_immutable');
  });

  it('rejects half a point rather than guessing the other half', () => {
    expect(() =>
      eventUpdateSchema.parse({
        expectedVersion: 1,
        title: 'A title that is long enough',
        description: 'A description that clears the minimum length.',
        venueName: 'Café des Délices',
        latitude: 36.7538,
        startsAt: START,
        endsAt: END,
        language: 'fr',
      }),
    ).toThrow();
  });
});
