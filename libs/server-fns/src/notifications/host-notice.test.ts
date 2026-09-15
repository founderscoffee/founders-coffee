import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import {
  createDb,
  createEvent,
  eq,
  scheduledNotifications,
  seed,
  user,
  type Db,
} from '@founders-coffee/db';

import {
  enqueueHostRsvpCancellationNotice,
  enqueueHostRsvpNotice,
} from './host-notice.js';

const HOST_ID = 'usr_hn_host';
const GUEST_ID = 'usr_hn_guest';

let seq = 0;

const setupDb = async (): Promise<Db> => {
  const db = createDb((env as unknown as { DB: D1Database }).DB);
  await seed(db);
  for (const [id, email] of [
    [HOST_ID, 'host@hn.test'],
    [GUEST_ID, 'guest@hn.test'],
  ]) {
    await db
      .insert(user)
      .values({
        id,
        name: id,
        email,
        emailVerified: true,
        role: 'member',
      })
      .onConflictDoNothing()
      .run();
  }
  return db;
};

const seedEvent = async (db: Db): Promise<{ id: string; slug: string }> => {
  const n = ++seq;
  const id = `evt_hn${String(n).padStart(3, '0')}`;
  const slug = `hn-event-${n}`;
  await createEvent(db, {
    id,
    slug,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: 'Coffee + Code',
    description: 'Host notice fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    capacity: 30,
    language: 'en',
    category: 'coffee-meetup',
    status: 'published',
  });
  return { id, slug };
};

const notice = (
  db: Db,
  eventId: string,
  overrides: Record<string, unknown> = {},
) =>
  enqueueHostRsvpNotice(db, {
    eventId,
    hostId: HOST_ID,
    guestId: GUEST_ID,
    eventTitle: 'Coffee + Code',
    eventSlug: 'hn-event',
    marketCode: 'DZ',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    venue: 'Café des Délices',
    hostEmail: 'host@hn.test',
    hostLocale: 'en',
    ...overrides,
  });

const rowsFor = (db: Db, eventId: string) =>
  db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, eventId));

describe('telling the host somebody is coming', () => {
  it('writes one notice addressed to the host, not the guest', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);

    await notice(db, event.id);

    const rows = await rowsFor(db, event.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(HOST_ID);
    expect(rows[0]?.templateKey).toBe('rsvp_received');
    expect(rows[0]?.channel).toBe('push');
    expect(rows[0]?.fallbackChannel).toBe('email');
  });

  it('collapses a burst into one message rather than one per guest', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);

    await notice(db, event.id);
    await notice(db, event.id, { guestId: 'usr_hn_other1' });
    await notice(db, event.id, { guestId: 'usr_hn_other2' });

    expect(await rowsFor(db, event.id)).toHaveLength(1);
  });

  it('opens a new window once the pending notice is gone', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);

    await notice(db, event.id);
    await db
      .update(scheduledNotifications)
      .set({ status: 'sent' })
      .where(eq(scheduledNotifications.eventId, event.id))
      .run();
    await notice(db, event.id, { guestId: 'usr_hn_other1' });

    expect(await rowsFor(db, event.id)).toHaveLength(2);
  });

  it('says nothing to a host who RSVPed to their own gathering', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);

    await notice(db, event.id, { guestId: HOST_ID });

    expect(await rowsFor(db, event.id)).toHaveLength(0);
  });

  it('claims no count, because a frozen payload cannot keep one true', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);

    await notice(db, event.id);

    const payload = (await rowsFor(db, event.id))[0]?.payload as Record<
      string,
      unknown
    >;
    expect(payload.pushTitle).toContain('Coffee + Code');
    expect(String(payload.pushTitle) + String(payload.pushBody)).not.toMatch(
      /\d/,
    );
  });

  it('waits, so there is a window for a burst to collapse into', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);

    await notice(db, event.id);

    const sendAt = (await rowsFor(db, event.id))[0]?.sendAt as Date;
    expect(sendAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });
});

describe('telling the host somebody cancelled', () => {
  it('writes an immediate push notice with an email fallback', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);

    await enqueueHostRsvpCancellationNotice(db, {
      eventId: event.id,
      hostId: HOST_ID,
      guestId: GUEST_ID,
      rsvpId: 'rsvp_hn_cancelled',
      eventTitle: 'Coffee + Code',
      eventSlug: event.slug,
      marketCode: 'DZ',
      startsAt: new Date('2099-01-15T18:00:00Z'),
      venue: 'Café des Délices',
      hostEmail: 'host@hn.test',
      hostLocale: 'en',
    });

    const row = (await rowsFor(db, event.id))[0];
    expect(row?.id).toBe(`ntf_rsvp_cancelled_${event.id}_rsvp_hn_cancelled`);
    expect(row?.userId).toBe(HOST_ID);
    expect(row?.templateKey).toBe('rsvp_cancelled');
    expect(row?.channel).toBe('push');
    expect(row?.fallbackChannel).toBe('email');
    expect(row?.sendAt.getTime()).toBeLessThanOrEqual(Date.now());
    const payload = row?.payload as Record<string, unknown>;
    expect(payload.pushUrl).toContain(`/${event.slug}`);
    expect(payload.smsBody).toBeUndefined();
  });

  it('does not notify a host about their own cancellation', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);

    await enqueueHostRsvpCancellationNotice(db, {
      eventId: event.id,
      hostId: HOST_ID,
      guestId: HOST_ID,
      rsvpId: 'rsvp_hn_host_cancelled',
      eventTitle: 'Coffee + Code',
      eventSlug: event.slug,
      marketCode: 'DZ',
      startsAt: new Date('2099-01-15T18:00:00Z'),
      venue: 'Café des Délices',
      hostEmail: 'host@hn.test',
      hostLocale: 'en',
    });

    expect(await rowsFor(db, event.id)).toHaveLength(0);
  });

  it('is idempotent when the cancellation producer is retried', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);
    const options = {
      eventId: event.id,
      hostId: HOST_ID,
      guestId: GUEST_ID,
      rsvpId: 'rsvp_hn_retry',
      eventTitle: 'Coffee + Code',
      eventSlug: event.slug,
      marketCode: 'DZ',
      startsAt: new Date('2099-01-15T18:00:00Z'),
      venue: 'Café des Délices',
      hostEmail: 'host@hn.test',
      hostLocale: 'en',
    };

    await enqueueHostRsvpCancellationNotice(db, options);
    await enqueueHostRsvpCancellationNotice(db, options);

    expect(await rowsFor(db, event.id)).toHaveLength(1);
  });
});

describe('when the gathering is about to start', () => {
  it('never schedules the notice past the start time', async () => {
    const db = await setupDb();
    const event = await seedEvent(db);
    const startsAt = new Date(Date.now() + 60_000);

    await notice(db, event.id, { startsAt });

    const sendAt = (
      await db
        .select()
        .from(scheduledNotifications)
        .where(eq(scheduledNotifications.eventId, event.id))
    )[0]?.sendAt as Date;
    expect(sendAt.getTime()).toBeLessThanOrEqual(startsAt.getTime());
  });
});
