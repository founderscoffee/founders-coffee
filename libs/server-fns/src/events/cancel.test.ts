import { describe, expect, it } from 'vitest';

import { sql } from 'drizzle-orm';

import {
  accountPreferences,
  createRsvp,
  eq,
  getEvent,
  listPendingNotifications,
  user,
  type Db,
} from '@founders-coffee/db';

import { cancelEventResolver } from './cancel.js';
import { createEventResolver } from './resolver.js';
import {
  createInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

const GUEST_ID = 'usr_cancel_guest01';

const inviteGuest = async (
  db: Db,
  eventId: string,
  phoneNumber: string | null = null,
) => {
  await db
    .insert(user)
    .values({
      id: GUEST_ID,
      name: 'Cancel Guest',
      email: 'cancel-guest@test.coffee',
      emailVerified: true,
      role: 'member',
    })
    .onConflictDoNothing()
    .run();
  await db
    .update(user)
    .set({ phoneNumber, phoneNumberVerified: phoneNumber !== null })
    .where(eq(user.id, GUEST_ID))
    .run();
  await db
    .insert(accountPreferences)
    .values({ userId: GUEST_ID, smsFallbackEnabled: phoneNumber !== null })
    .onConflictDoUpdate({
      target: accountPreferences.userId,
      set: { smsFallbackEnabled: phoneNumber !== null },
    });
  await createRsvp(db, { id: `rsv_${eventId}`, eventId, userId: GUEST_ID });
};

const cancellationFor = async (db: Db, eventId: string) => {
  const pending = await listPendingNotifications(db, {
    now: new Date('2099-01-14T18:00:00Z'),
    limit: 50,
  });
  return pending.find(
    (row) => row.eventId === eventId && row.templateKey === 'event_cancelled',
  );
};

const hostAnEvent = async (db: Db) => {
  const result = await createEventResolver(
    db,
    testMapProvider,
    TEST_HOST_ID,
    createInput(),
  );
  if (!result.ok) throw new Error('fixture event was not created');
  return result.data;
};

describe('cancelEventResolver', () => {
  it('refuses a caller who does not host the event', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    const result = await cancelEventResolver(db, {
      eventId: event.id,
      actorId: 'usr_somebody_else',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_host');
    expect((await getEvent(db, event.id))?.status).toBe('published');
  });

  it('reports a missing event rather than pretending to cancel it', async () => {
    const db = await setupDb();

    const result = await cancelEventResolver(db, {
      eventId: 'evt_does_not_exist',
      actorId: TEST_HOST_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });

  it('cancels for the host, keeping the row and recording the reason', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    const result = await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
      reason: '  the café closed  ',
    });

    expect(result.ok).toBe(true);
    const stored = await getEvent(db, event.id);
    expect(stored?.status).toBe('cancelled');
    expect(stored?.cancellationReason).toBe('the café closed');
    expect(stored?.cancelledAt).toBeTruthy();
  });

  it('leaves the reason unset when the host wrote only whitespace', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
      reason: '   ',
    });

    expect((await getEvent(db, event.id))?.cancellationReason).toBeNull();
  });

  it('is idempotent, so a second tap notifies nobody twice', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event.id);

    const first = await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
    });
    const second = await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
    });

    expect(first.ok && first.data.event.status).toBe('cancelled');
    expect(first.ok && first.data.notified).toBe(1);
    expect(second.ok && second.data.notified).toBe(0);
  });

  it('texts a consented member when the gathering is today, which is the whole point of keeping SMS', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event.id, '+213600000042');
    await db.run(
      sql`UPDATE events SET starts_at = unixepoch() + 3600 WHERE id = ${event.id}`,
    );

    await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
    });

    const notice = await cancellationFor(db, event.id);
    expect(notice?.channel).toBe('push');
    expect(notice?.fallbackChannel).toBe('sms');
    const payload = notice?.payload as Record<string, unknown>;
    expect(payload.pushTitle).toBeTruthy();
    expect(payload.smsBody).toBeTruthy();
  });

  it('emails the same member when the gathering is weeks away, rather than billing for news', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event.id, '+213600000042');

    await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
    });

    const notice = await cancellationFor(db, event.id);
    expect(notice?.channel).toBe('push');
    expect(notice?.fallbackChannel).toBe('email');
    expect((notice?.payload as Record<string, unknown>).subject).toBeTruthy();
  });

  it('falls back to email for an attendee with no consented number, not to nothing', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event.id);

    await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
      reason: 'the café closed',
    });

    const notice = await cancellationFor(db, event.id);
    expect(notice?.channel).toBe('push');
    expect(notice?.fallbackChannel).toBe('email');
    const payload = notice?.payload as Record<string, unknown>;
    expect(payload.pushTitle).toBeTruthy();
    expect(payload.subject).toBeTruthy();
    expect(payload.html).toContain('the café closed');
  });

  it('drops the pending reminders instead of leaving them to fire', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
    });

    const pending = await listPendingNotifications(db, {
      now: new Date('2099-01-14T18:00:00Z'),
      limit: 50,
    });
    expect(
      pending.filter(
        (row) =>
          row.eventId === event.id && row.templateKey !== 'event_cancelled',
      ),
    ).toHaveLength(0);
  });
});
