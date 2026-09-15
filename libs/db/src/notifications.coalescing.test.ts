import { beforeEach, describe, expect, it } from 'vitest';

import {
  enqueueNotificationIfNoPending,
  eq,
  scheduledNotifications,
  type Db,
} from './index.js';
import { HOST_ID, futureEvent, setupDb } from './operations.fixtures.js';

const payload = {
  eventTitle: 'Coffee + Code',
  eventSlug: 'coffee-and-code',
  marketCode: 'DZ',
  startsAt: new Date('2099-01-15T18:00:00Z').toISOString(),
  venue: 'Café des Délices',
  locale: 'en',
  pushTitle: 'Someone joined',
  pushBody: 'Open the event',
};

describe('coalesced notification enqueue', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('lets only one concurrent writer open a pending window', async () => {
    const eventId = await futureEvent(db);
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        enqueueNotificationIfNoPending(db, {
          id: `ntf_coalesce_${index}`,
          eventId,
          userId: HOST_ID,
          channel: 'push',
          templateKey: 'rsvp_received',
          payload,
          sendAt: new Date('2099-01-15T17:00:00Z'),
        }),
      ),
    );

    expect(results.filter((result) => result.written)).toHaveLength(1);
    const rows = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.eventId, eventId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.templateKey).toBe('rsvp_received');
    expect(rows[0]?.status).toBe('pending');
  });
});
