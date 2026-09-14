import { beforeEach, describe, expect, it } from 'vitest';

import {
  cancelNotificationsByUserEvent,
  enqueueNotification,
  type Db,
} from './index.js';
import { eq, scheduledNotifications } from './index.js';
import {
  HOST_ID,
  MEMBER_ID,
  futureEvent,
  setupDb,
} from './operations.fixtures.js';

const payloadFor = (email: string) => ({
  email,
  eventTitle: 'Coffee + Code',
  eventSlug: 'coffee-and-code',
  marketCode: 'DZ',
  startsAt: new Date('2099-01-15T18:00:00Z').toISOString(),
  venue: 'Café des Délices',
  locale: 'en',
  pushTitle: 'x',
  pushBody: 'y',
});

const enqueue = (
  db: Db,
  eventId: string,
  userId: string,
  templateKey: string,
  id: string,
) =>
  enqueueNotification(db, {
    id,
    eventId,
    userId,
    channel: 'push',
    templateKey: templateKey as 'rsvp_confirmation',
    payload: payloadFor('m@test.coffee'),
    sendAt: new Date(),
  });

const statuses = async (db: Db, eventId: string) => {
  const rows = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, eventId));
  return Object.fromEntries(rows.map((r) => [r.templateKey, r.status]));
};

describe('what cancelling an RSVP withdraws', () => {
  let db: Db;
  let eventId: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await futureEvent(db);
  });

  it('withdraws the messages that exist because the member said they were coming', async () => {
    await enqueue(db, eventId, MEMBER_ID, 'rsvp_confirmation', 'ntf_cs_1');
    await enqueue(db, eventId, MEMBER_ID, 'reminder_24h', 'ntf_cs_2');

    await cancelNotificationsByUserEvent(db, { eventId, userId: MEMBER_ID });

    expect(await statuses(db, eventId)).toEqual({
      rsvp_confirmation: 'cancelled',
      reminder_24h: 'cancelled',
    });
  });

  it('leaves a host-directed notice alone when the host drops their own RSVP', async () => {
    await enqueue(db, eventId, HOST_ID, 'rsvp_received', 'ntf_cs_3');
    await enqueue(db, eventId, HOST_ID, 'reminder_24h', 'ntf_cs_4');

    await cancelNotificationsByUserEvent(db, { eventId, userId: HOST_ID });

    expect(await statuses(db, eventId)).toEqual({
      rsvp_received: 'pending',
      reminder_24h: 'cancelled',
    });
  });

  it('does not reach another member’s rows', async () => {
    await enqueue(db, eventId, MEMBER_ID, 'rsvp_confirmation', 'ntf_cs_5');
    await enqueue(db, eventId, HOST_ID, 'rsvp_confirmation', 'ntf_cs_6');

    const changed = await cancelNotificationsByUserEvent(db, {
      eventId,
      userId: MEMBER_ID,
    });

    expect(changed).toBe(1);
  });
});
