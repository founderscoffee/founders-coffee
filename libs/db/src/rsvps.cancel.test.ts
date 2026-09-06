import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { batch } from './atomic.js';
import type { Db } from './index.js';
import { cancelRsvp, createRsvp, isDuplicateRsvpError } from './rsvps.js';
import {
  counters,
  fill,
  members,
  seedEvent,
  setupDb,
} from './rsvps.fixtures.js';
import { eventRsvps, events } from './schema.js';

describe('cancelRsvp (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('removes the attendee and decrements the counter together', async () => {
    const eventId = await seedEvent(db);
    await fill(db, eventId, 2);

    const result = await cancelRsvp(db, { eventId, userId: members[0].id });

    expect(result.deleted).toBe(true);
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('decrements nothing when there was no RSVP', async () => {
    const eventId = await seedEvent(db);
    await fill(db, eventId, 1);

    const result = await cancelRsvp(db, { eventId, userId: members[4].id });

    expect(result.deleted).toBe(false);
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('decrements once for two concurrent cancels of the same RSVP', async () => {
    const eventId = await seedEvent(db);
    await fill(db, eventId, 2);

    const results = await Promise.all([
      cancelRsvp(db, { eventId, userId: members[0].id }),
      cancelRsvp(db, { eventId, userId: members[0].id }),
    ]);

    expect(results.filter((r) => r.deleted)).toHaveLength(1);
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('never drives the counter below zero', async () => {
    const eventId = await seedEvent(db);
    await fill(db, eventId, 1);
    await db
      .update(events)
      .set({ rsvps: 0 })
      .where(eq(events.id, eventId))
      .run();

    const result = await cancelRsvp(db, { eventId, userId: members[0].id });

    expect(result.deleted).toBe(true);
    expect((await counters(db, eventId)).counter).toBe(0);
  });

  it('round-trips: rsvp, cancel, rsvp again', async () => {
    const eventId = await seedEvent(db);

    expect(
      (await createRsvp(db, { id: 'rt_1', eventId, userId: members[0].id }))
        .outcome,
    ).toBe('created');
    await cancelRsvp(db, { eventId, userId: members[0].id });
    expect(await counters(db, eventId)).toEqual({ counter: 0, attendees: 0 });

    expect(
      (await createRsvp(db, { id: 'rt_3', eventId, userId: members[1].id }))
        .outcome,
    ).toBe('created');
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });
});

describe('duplicate-RSVP error detection', () => {
  const captureError = async (
    run: () => Promise<unknown>,
  ): Promise<unknown> => {
    try {
      await run();
      return null;
    } catch (error) {
      return error;
    }
  };

  it('classifies the error the batch path actually throws', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await createRsvp(db, { id: 'dup_b_a', eventId, userId: members[0].id });

    const error = await captureError(() =>
      batch(db, [
        db.insert(eventRsvps).select(
          sql`SELECT 'dup_b_b', ${eventId}, ${members[0].id}, 'going', unixepoch(), unixepoch()
              FROM events WHERE id = ${eventId}`,
        ),
      ]),
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('UNIQUE constraint failed');
    expect((error as Error).message).toContain('event_rsvps.event_id');
    expect(isDuplicateRsvpError(error)).toBe(true);
  });

  it('classifies a Drizzle-wrapped error through its cause chain', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await createRsvp(db, { id: 'dup_w_a', eventId, userId: members[0].id });

    const error = await captureError(() =>
      db
        .insert(eventRsvps)
        .values({
          id: 'dup_w_b',
          eventId,
          userId: members[0].id,
          status: 'going',
        })
        .run(),
    );

    expect((error as Error).message).not.toContain('UNIQUE constraint failed');
    expect(isDuplicateRsvpError(error)).toBe(true);
  });

  it('does not classify an unrelated failure as a duplicate RSVP', () => {
    expect(
      isDuplicateRsvpError(
        new Error(
          'D1_ERROR: UNIQUE constraint failed: events.slug: SQLITE_CONSTRAINT',
        ),
      ),
    ).toBe(false);
    expect(isDuplicateRsvpError(new Error('D1_ERROR: no such table'))).toBe(
      false,
    );
    expect(isDuplicateRsvpError(null)).toBe(false);
  });
});

describe('counter/attendee invariant under mixed traffic', () => {
  /**
   * Deliberately long: 120 randomized operations, each followed by a full read-back, is roughly
   * 360 D1 round trips. It runs in ~130ms locally and comfortably inside 5s, but a shared CI
   * runner is slow enough to blow the default timeout — which it did. The step count is the
   * property being tested, so the timeout gives way rather than the coverage.
   */
  it('never diverges across a randomized rsvp/cancel sequence', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);

    let seq = 0;
    const rand = () => {
      seq = (seq * 1103515245 + 12345) % 2147483648;
      return seq / 2147483648;
    };

    for (let step = 0; step < 120; step++) {
      const member = members[Math.floor(rand() * members.length)];
      if (rand() < 0.6) {
        await createRsvp(db, {
          id: `inv_${step}`,
          eventId,
          userId: member.id,
        });
      } else {
        await cancelRsvp(db, { eventId, userId: member.id });
      }

      const { counter, attendees } = await counters(db, eventId);
      expect(counter).toBe(attendees);
      expect(counter).toBeGreaterThanOrEqual(0);
      expect(counter).toBeLessThanOrEqual(members.length);
    }
  }, 30_000);

  it('holds when the same batch of operations is issued concurrently', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);

    for (let round = 0; round < 10; round++) {
      await Promise.all([
        createRsvp(db, { id: `cc_${round}_0`, eventId, userId: members[0].id }),
        createRsvp(db, { id: `cc_${round}_1`, eventId, userId: members[1].id }),
        createRsvp(db, { id: `cc_${round}_2`, eventId, userId: members[2].id }),
        cancelRsvp(db, { eventId, userId: members[0].id }),
        cancelRsvp(db, { eventId, userId: members[3].id }),
      ]);

      const { counter, attendees } = await counters(db, eventId);
      expect(counter).toBe(attendees);
      expect(counter).toBeGreaterThanOrEqual(0);
      expect(counter).toBeLessThanOrEqual(2);
    }
  });
});
