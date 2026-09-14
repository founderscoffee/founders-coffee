import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { countJoinedEvents, listJoinedEvents } from './events-joined.js';
import { cancelRsvp } from './rsvps.js';
import { user } from './schema.js';
import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  futureEvent,
  setupDb,
} from './operations.fixtures.js';

describe('listJoinedEvents', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('lists a gathering the member said they were coming to', async () => {
    const eventId = await futureEvent(db, { attendees: [MEMBER_ID] });

    const joined = await listJoinedEvents(db, { userId: MEMBER_ID });

    expect(joined.map((event) => event.id)).toEqual([eventId]);
  });

  it('lists nothing for a member who has joined nothing', async () => {
    await futureEvent(db);

    expect(await listJoinedEvents(db, { userId: MEMBER_ID })).toEqual([]);
  });

  it('does not list one member’s gatherings to another', async () => {
    await futureEvent(db, { attendees: [MEMBER_ID] });

    expect(await listJoinedEvents(db, { userId: OTHER_ID })).toEqual([]);
  });

  it('drops a gathering once the member cancels their RSVP', async () => {
    const eventId = await futureEvent(db, { attendees: [MEMBER_ID] });
    await cancelRsvp(db, { eventId, userId: MEMBER_ID });

    expect(await listJoinedEvents(db, { userId: MEMBER_ID })).toEqual([]);
  });

  it('keeps a cancelled event, which the member still needs to see', async () => {
    const eventId = await futureEvent(db, { attendees: [MEMBER_ID] });
    await db.run(
      sql`UPDATE events SET status = 'cancelled' WHERE id = ${eventId}`,
    );

    expect(
      (await listJoinedEvents(db, { userId: MEMBER_ID })).map((e) => e.status),
    ).toEqual(['cancelled']);
  });

  it('hides a gathering whose host is no longer a visible identity', async () => {
    await futureEvent(db, { attendees: [MEMBER_ID] });
    await db
      .update(user)
      .set({ accountState: 'closing' })
      .where(sql`id = ${HOST_ID}`)
      .run();

    expect(await listJoinedEvents(db, { userId: MEMBER_ID })).toEqual([]);
  });

  it('orders newest first, like the hosted list beside it', async () => {
    const older = await futureEvent(db, { attendees: [MEMBER_ID] });
    const newer = await futureEvent(db, { attendees: [MEMBER_ID] });
    await db.run(
      sql`UPDATE events SET starts_at = unixepoch() + 100 WHERE id = ${older}`,
    );
    await db.run(
      sql`UPDATE events SET starts_at = unixepoch() + 200 WHERE id = ${newer}`,
    );

    const joined = await listJoinedEvents(db, { userId: MEMBER_ID });

    expect(joined.map((event) => event.id)).toEqual([newer, older]);
  });

  it('filters by market when one is named', async () => {
    await futureEvent(db, { attendees: [MEMBER_ID] });

    expect(
      await listJoinedEvents(db, { userId: MEMBER_ID, marketCode: 'DZ' }),
    ).toHaveLength(1);
    expect(
      await listJoinedEvents(db, { userId: MEMBER_ID, marketCode: 'EG' }),
    ).toEqual([]);
  });

  it('pages from a cursor without repeating a row', async () => {
    const first = await futureEvent(db, { attendees: [MEMBER_ID] });
    const second = await futureEvent(db, { attendees: [MEMBER_ID] });
    await db.run(
      sql`UPDATE events SET starts_at = unixepoch() + 100 WHERE id = ${first}`,
    );
    await db.run(
      sql`UPDATE events SET starts_at = unixepoch() + 200 WHERE id = ${second}`,
    );

    const page = await listJoinedEvents(db, { userId: MEMBER_ID, limit: 1 });
    const next = await listJoinedEvents(db, {
      userId: MEMBER_ID,
      beforeStartsAt: page[0]?.startsAt,
      beforeId: page[0]?.id,
      limit: 1,
    });

    expect(page.map((e) => e.id)).toEqual([second]);
    expect(next.map((e) => e.id)).toEqual([first]);
  });
});

describe('countJoinedEvents', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('counts over the same predicate the pages walk', async () => {
    await futureEvent(db, { attendees: [MEMBER_ID] });
    await futureEvent(db, { attendees: [MEMBER_ID] });

    expect(await countJoinedEvents(db, { userId: MEMBER_ID })).toBe(2);
  });

  it('is zero rather than absent for a member who has joined nothing', async () => {
    expect(await countJoinedEvents(db, { userId: MEMBER_ID })).toBe(0);
  });

  it('agrees with the list after a cancellation', async () => {
    const eventId = await futureEvent(db, { attendees: [MEMBER_ID] });
    await futureEvent(db, { attendees: [MEMBER_ID] });
    await cancelRsvp(db, { eventId, userId: MEMBER_ID });

    const listed = await listJoinedEvents(db, { userId: MEMBER_ID });
    expect(await countJoinedEvents(db, { userId: MEMBER_ID })).toBe(
      listed.length,
    );
  });
});
