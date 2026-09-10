import { sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { createDb, type Db } from './index.js';
import { RSVP_INSERT_COLUMNS, createRsvp, getRsvpForUser } from './rsvps.js';
import {
  counters,
  fill,
  members,
  seedEvent,
  setupDb,
} from './rsvps.fixtures.js';
import { eventRsvps } from './schema.js';

describe('rsvp insert-select column contract', () => {
  it('matches the column list Drizzle generates for event_rsvps', () => {
    const db = createDb(env.DB);
    const generated = db
      .insert(eventRsvps)
      .select(sql`SELECT 1`)
      .toSQL()
      .sql.match(/\(([^)]*)\)/)?.[1];
    const columns = (generated ?? '')
      .split(',')
      .map((c) => c.trim().replace(/"/g, ''));
    expect(columns).toEqual([...RSVP_INSERT_COLUMNS]);
  });
});

describe('createRsvp (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('records an attendee and increments the counter together', async () => {
    const eventId = await seedEvent(db);

    const result = await createRsvp(db, {
      id: 'rsvp_ok_1',
      eventId,
      userId: members[0].id,
    });

    expect(result.outcome).toBe('created');
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('writes nothing when the event has gone', async () => {
    const result = await createRsvp(db, {
      id: 'rsvp_missing_1',
      eventId: 'evt_never_existed',
      userId: members[5].id,
    });

    expect(result.outcome).toBe('event_missing');
    expect(
      await getRsvpForUser(db, {
        eventId: 'evt_never_existed',
        userId: members[5].id,
      }),
    ).toBeUndefined();
  });

  it('takes every attendee, however many turn up', async () => {
    const eventId = await seedEvent(db);
    await fill(db, eventId, 5);

    const result = await createRsvp(db, {
      id: 'rsvp_unlimited',
      eventId,
      userId: members[5].id,
    });

    expect(result.outcome).toBe('created');
    expect(await counters(db, eventId)).toEqual({ counter: 6, attendees: 6 });
  });

  it('returns already_rsvpd for a duplicate instead of throwing', async () => {
    const eventId = await seedEvent(db);
    await createRsvp(db, {
      id: 'rsvp_dupe_a',
      eventId,
      userId: members[0].id,
    });

    const duplicate = await createRsvp(db, {
      id: 'rsvp_dupe_b',
      eventId,
      userId: members[0].id,
    });

    expect(duplicate.outcome).toBe('already_rsvpd');
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('keeps the counter level with the attendee rows under concurrency', async () => {
    const eventId = await seedEvent(db);

    const outcomes = await Promise.all([
      createRsvp(db, { id: 'rsvp_race_a', eventId, userId: members[2].id }),
      createRsvp(db, { id: 'rsvp_race_b', eventId, userId: members[3].id }),
      createRsvp(db, { id: 'rsvp_race_c', eventId, userId: members[4].id }),
    ]);

    expect(outcomes.filter((o) => o.outcome === 'created')).toHaveLength(3);
    expect(await counters(db, eventId)).toEqual({ counter: 3, attendees: 3 });
  });

  it('keeps counter and attendee rows in step for concurrent duplicates', async () => {
    const eventId = await seedEvent(db);

    const outcomes = await Promise.all([
      createRsvp(db, { id: 'rsvp_cd_a', eventId, userId: members[0].id }),
      createRsvp(db, { id: 'rsvp_cd_b', eventId, userId: members[0].id }),
    ]);

    expect(outcomes.filter((o) => o.outcome === 'created')).toHaveLength(1);
    expect(outcomes.filter((o) => o.outcome === 'already_rsvpd')).toHaveLength(
      1,
    );
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('rethrows an error that is not a duplicate RSVP', async () => {
    const eventId = await seedEvent(db);

    await expect(
      createRsvp(db, {
        id: 'rsvp_badfk',
        eventId,
        userId: 'usr_does_not_exist',
      }),
    ).rejects.toThrow();
    expect(await counters(db, eventId)).toEqual({ counter: 0, attendees: 0 });
  });
});
