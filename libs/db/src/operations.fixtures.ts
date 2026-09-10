import { env } from 'cloudflare:workers';
import { inArray, sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import { createDb } from './db.js';
import { createEvent } from './events.js';
import { createRsvp } from './rsvps.js';
import { seed } from './seed.js';
import type { Db } from './db.js';
import {
  communityMetricSnapshots,
  eventAttendance,
  eventCloseouts,
  eventFeedback,
  events,
  hostTrust,
  operationsAudit,
  operationsReviews,
  user,
} from './schema.js';

export const HOST_ID = 'usr_ops_host';
export const MEMBER_ID = 'usr_ops_member';
export const OTHER_ID = 'usr_ops_other';

const HOUR = 60 * 60 * 1000;

/**
 * A market, three people, and a clean operations slate.
 *
 * The tables are emptied rather than the database recreated, because these suites share one
 * Miniflare D1 and a leftover closeout would make an idempotency test pass for the wrong reason.
 * The accounts are reset with them: the users are upserted `ON CONFLICT DO NOTHING`, so a test that
 * suppresses the host to prove a visibility rule would otherwise leave it suppressed for every test
 * that ran after it — which reads as a broken query rather than a dirty fixture.
 * The fixture's own events go too: an attention query that lists every event needing attention will
 * otherwise accumulate one per test and pass on the wrong row.
 */
export const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .insert(user)
    .values([
      {
        id: HOST_ID,
        name: 'Ops Host',
        email: 'ops-host@test.coffee',
        role: 'host',
      },
      { id: MEMBER_ID, name: 'Ops Member', email: 'ops-member@test.coffee' },
      { id: OTHER_ID, name: 'Ops Other', email: 'ops-other@test.coffee' },
    ])
    .onConflictDoNothing()
    .run();
  await db
    .update(user)
    .set({ accountState: 'active' })
    .where(inArray(user.id, [HOST_ID, MEMBER_ID, OTHER_ID]))
    .run();
  await db.delete(eventFeedback).run();
  await db.delete(eventAttendance).run();
  await db.delete(eventCloseouts).run();
  await db.delete(operationsAudit).run();
  await db.delete(hostTrust).run();
  await db.delete(operationsReviews).run();
  await db.delete(communityMetricSnapshots).run();
  await db.run(sql`DELETE FROM events WHERE id LIKE 'evt_ops%'`);
  return db;
};

let counter = 0;

/**
 * An event that has already finished, with whoever said they were coming.
 *
 * Built forwards and then moved backwards, which is the only order that works now that §5.17 freezes
 * RSVP intent at `startsAt`: an RSVP created against an event that has already started is refused,
 * so the attendees have to join while the event is still ahead of them. The times are then rewritten
 * so the operations guards — which read the database's clock rather than a passed-in time — see a
 * genuinely elapsed event.
 *
 * `withEndsAt: false` leaves the end null, which §5.24 makes a first-class case rather than bad data.
 */
export const pastEvent = async (
  db: Db,
  options: {
    endedHoursAgo?: number;
    status?: 'published' | 'cancelled';
    withEndsAt?: boolean;
    hostId?: string;
    attendees?: readonly string[];
  } = {},
): Promise<string> => {
  const eventId = `evt_ops${String(++counter).padStart(3, '0')}`;
  await createEvent(db, {
    id: eventId,
    slug: `ops-fixture-${counter}`,
    hostId: options.hostId ?? HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Ops fixture ${counter}`,
    description: 'An event used to exercise the operations schema.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date(Date.now() + 48 * HOUR),
    endsAt: new Date(Date.now() + 50 * HOUR),
    language: 'fr',
    status: options.status ?? 'published',
  });

  for (const userId of options.attendees ?? []) {
    await createRsvp(db, { id: id('rsv'), eventId, userId });
  }

  const endedHoursAgo = options.endedHoursAgo ?? 2;
  const endsAt = Math.floor(Date.now() / 1000) - endedHoursAgo * 3600;
  await db.run(
    sql`UPDATE events
        SET starts_at = ${endsAt - 7200},
            ends_at = ${options.withEndsAt === false ? null : endsAt}
        WHERE id = ${eventId}`,
  );
  return eventId;
};

/** An event still to come, for the guards that must refuse one. */
export const futureEvent = async (
  db: Db,
  options: { attendees?: readonly string[] } = {},
): Promise<string> => {
  const eventId = `evt_ops${String(++counter).padStart(3, '0')}`;
  await createEvent(db, {
    id: eventId,
    slug: `ops-future-${counter}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Ops future ${counter}`,
    description: 'An event that has not happened yet.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date(Date.now() + 48 * HOUR),
    endsAt: new Date(Date.now() + 50 * HOUR),
    language: 'fr',
    status: 'published',
  });
  for (const userId of options.attendees ?? []) {
    await createRsvp(db, { id: id('rsv'), eventId, userId });
  }
  return eventId;
};

export const auditRows = (db: Db) =>
  db.select().from(operationsAudit).orderBy(operationsAudit.createdAt);

export const eventRow = async (db: Db, eventId: string) => {
  const rows = await db
    .select()
    .from(events)
    .where(sql`id = ${eventId}`)
    .limit(1);
  return rows[0];
};
