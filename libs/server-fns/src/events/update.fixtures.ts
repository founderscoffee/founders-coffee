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
  createTestEvent,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

export const GUEST_ID = 'usr_update_guest01';
export const START = new Date('2099-01-15T18:00:00Z').getTime();
export const END = new Date('2099-01-15T19:00:00Z').getTime();

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

export const hostAnEvent = async (db: Db): Promise<Event> => {
  const result = await createEventResolver(
    db,
    testMapProvider,
    TEST_HOST_ID,
    createInput(),
  );
  if (!result.ok) throw new Error('fixture event was not created');
  return result.data;
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
