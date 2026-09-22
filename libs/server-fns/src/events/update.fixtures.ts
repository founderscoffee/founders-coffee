import {
  accountPreferences,
  createEvent,
  createRsvp,
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
  baseEvent,
  createInput,
  nextId,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

export const GUEST_ID = 'usr_update_guest01';
export const START = new Date('2099-01-15T18:00:00Z').getTime();
export const END = new Date('2099-01-15T19:00:00Z').getTime();

const ALGIERS_CITY_CODE = '556';

export const ALGIERS = { latitude: 36.7538, longitude: 3.0588 };
export const ACROSS_TOWN = { latitude: 36.7558, longitude: 3.0588 };
export const SAME_DOORWAY = { latitude: 36.7543, longitude: 3.0588 };

export const inviteGuest = async (db: Db, event: Event) => {
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

export const hostAnEvent = async (
  db: Db,
  overrides: Record<string, unknown> = {},
): Promise<Event> => {
  const result = await createEventResolver(
    db,
    testMapProvider,
    TEST_HOST_ID,
    createInput(overrides),
  );
  if (!result.ok) throw new Error('fixture event was not created');
  return result.data;
};

/**
 * A meetup created in the city the stub map provider resolves every point to.
 *
 * `createInput` defaults to city `1`, which is Adrar — six hundred kilometres south of the point it
 * also carries. The mismatch is harmless while nothing geocodes and fatal the moment something
 * does: the city guard compares the city derived from the new pin to the stored one, and refuses
 * the edit when they disagree. Anything that moves a pin has to start in the city the stub names.
 */
export const hostAnEventInAlgiers = (
  db: Db,
  overrides: Record<string, unknown> = {},
): Promise<Event> =>
  hostAnEvent(db, { cityCode: ALGIERS_CITY_CODE, ...overrides });

/** The same city, but stored without coordinates, which is what most published rows look like. */
export const unpinnedEventInAlgiers = async (db: Db): Promise<Event> => {
  const id = nextId();
  await createEvent(db, {
    ...baseEvent(id, `unpinned-${id}`),
    cityCode: ALGIERS_CITY_CODE,
    endsAt: new Date(END),
  });
  const stored = await getEvent(db, id);
  if (!stored) throw new Error('fixture event was not created');
  return stored;
};

export const editOf = (event: Event, overrides: Record<string, unknown> = {}) =>
  eventUpdateSchema.parse({
    expectedVersion: event.version,
    title: event.title,
    description: event.description,
    venueName: event.venue,
    startsAt: START,
    endsAt: END,
    language: event.language,
    ...overrides,
  });

export const apply = (
  db: Db,
  event: Event,
  overrides: Record<string, unknown> = {},
) =>
  updateEventResolver(db, testMapProvider, {
    eventId: event.id,
    actorId: TEST_HOST_ID,
    input: editOf(event, overrides),
  });

export const pendingFor = async (
  db: Db,
  eventId: string,
  templateKey: string,
) => {
  const rows = await listPendingNotifications(db, {
    now: new Date('2099-01-14T18:00:00Z'),
    limit: 50,
  });
  return rows.filter(
    (row) => row.eventId === eventId && row.templateKey === templateKey,
  );
};
