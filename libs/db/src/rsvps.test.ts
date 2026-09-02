import { eq, sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { batch } from './atomic.js';
import { createDb, type Db } from './index.js';
import {
  RSVP_INSERT_COLUMNS,
  cancelRsvp,
  createRsvp,
  getRsvpForUser,
  isDuplicateRsvpError,
} from './rsvps.js';
import {
  captureError,
  counters,
  fill,
  members,
  seedEvent,
  setupDb,
} from './rsvps.fixtures.js';
import { eventRsvps, events } from './schema.js';

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

describe('createRsvp capacity (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('records an attendee and increments the counter together', async () => {
    const eventId = await seedEvent(db, 3);

    const result = await createRsvp(db, {
      id: 'rsvp_ok_1',
      eventId,
      userId: members[0].id,
    });

    expect(result.outcome).toBe('created');
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('writes nothing when the event is already at capacity', async () => {
    const eventId = await seedEvent(db, 2);
    await fill(db, eventId, 2);
    expect(await counters(db, eventId)).toEqual({ counter: 2, attendees: 2 });

    const result = await createRsvp(db, {
      id: 'rsvp_full_1',
      eventId,
      userId: members[5].id,
    });

    expect(result.outcome).toBe('event_full');
    expect(await counters(db, eventId)).toEqual({ counter: 2, attendees: 2 });
    expect(
      await getRsvpForUser(db, { eventId, userId: members[5].id }),
    ).toBeUndefined();
  });

  it('accepts the final seat, then rejects the next attempt', async () => {
    const eventId = await seedEvent(db, 3);
    await fill(db, eventId, 2);

    const last = await createRsvp(db, {
      id: 'rsvp_last',
      eventId,
      userId: members[2].id,
    });
    expect(last.outcome).toBe('created');
    expect(await counters(db, eventId)).toEqual({ counter: 3, attendees: 3 });

    const overflow = await createRsvp(db, {
      id: 'rsvp_overflow',
      eventId,
      userId: members[3].id,
    });
    expect(overflow.outcome).toBe('event_full');
    expect(await counters(db, eventId)).toEqual({ counter: 3, attendees: 3 });
  });

  it('treats capacity 0 as unlimited', async () => {
    const eventId = await seedEvent(db, 0);
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
    const eventId = await seedEvent(db, 5);
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

  it('lets exactly one concurrent attempt take the final seat', async () => {
    const eventId = await seedEvent(db, 3);
    await fill(db, eventId, 2);

    const outcomes = await Promise.all([
      createRsvp(db, { id: 'rsvp_race_a', eventId, userId: members[2].id }),
      createRsvp(db, { id: 'rsvp_race_b', eventId, userId: members[3].id }),
      createRsvp(db, { id: 'rsvp_race_c', eventId, userId: members[4].id }),
    ]);

    const created = outcomes.filter((o) => o.outcome === 'created');
    expect(created).toHaveLength(1);
    expect(await counters(db, eventId)).toEqual({ counter: 3, attendees: 3 });
  });

  it('keeps counter and attendee rows in step for concurrent duplicates', async () => {
    const eventId = await seedEvent(db, 5);

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
    const eventId = await seedEvent(db, 5);

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
