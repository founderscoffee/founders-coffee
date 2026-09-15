import { beforeEach, describe, expect, it } from 'vitest';

import { eq, scheduledNotifications, type Db } from '@founders-coffee/db';

import { cancelRsvpResolver, createRsvpResolver } from './resolver.js';
import { HOST_ID, members, seedEvent, setupDb } from './resolver.fixtures.js';

describe('RSVP cancellation host notices', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('withdraws the coalesced join notice and tells the host about the cancellation', async () => {
    const eventId = await seedEvent(db);
    await createRsvpResolver(db, { eventId, userId: members[0].id });

    await cancelRsvpResolver(db, { eventId, userId: members[0].id });

    const rows = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.eventId, eventId));
    expect(
      rows.find((row) => row.templateKey === 'rsvp_received')?.status,
    ).toBe('cancelled');
    expect(
      rows.find((row) => row.templateKey === 'rsvp_cancelled'),
    ).toMatchObject({ userId: HOST_ID, status: 'pending' });
  });

  it('keeps a join notice for another guest while adding one cancellation notice', async () => {
    const eventId = await seedEvent(db);
    await createRsvpResolver(db, { eventId, userId: members[0].id });
    await createRsvpResolver(db, { eventId, userId: members[1].id });

    await cancelRsvpResolver(db, { eventId, userId: members[0].id });

    const rows = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.eventId, eventId));
    expect(
      rows.find((row) => row.templateKey === 'rsvp_received')?.status,
    ).toBe('pending');
    expect(
      rows.filter((row) => row.templateKey === 'rsvp_cancelled'),
    ).toHaveLength(1);
  });

  it('does not tell the host when the host withdraws their own RSVP', async () => {
    const eventId = await seedEvent(db);
    await createRsvpResolver(db, { eventId, userId: HOST_ID });

    await cancelRsvpResolver(db, { eventId, userId: HOST_ID });

    const rows = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.eventId, eventId));
    expect(rows.filter((row) => row.templateKey === 'rsvp_cancelled')).toEqual(
      [],
    );
  });
});
