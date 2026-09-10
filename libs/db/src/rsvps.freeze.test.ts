import { describe, expect, it } from 'vitest';

import { cancelRsvp, createRsvp } from './rsvps.js';
import {
  counters,
  members,
  seedEvent,
  setStartOffset,
  setupDb,
} from './rsvps.fixtures.js';

let seq = 0;
const rsvpId = () => `rsvp_freeze_${++seq}`;

describe('CO-02 — RSVP intent freezes when the gathering starts', () => {
  it('accepts an RSVP while the event is still ahead', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await setStartOffset(db, eventId, 60);

    const result = await createRsvp(db, {
      id: rsvpId(),
      eventId,
      userId: members[0].id,
    });

    expect(result.outcome).toBe('created');
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('refuses an RSVP once the event has started, and counts nothing', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await setStartOffset(db, eventId, -1);

    const result = await createRsvp(db, {
      id: rsvpId(),
      eventId,
      userId: members[1].id,
    });

    expect(result.outcome).toBe('rsvp_closed');
    expect(await counters(db, eventId)).toEqual({ counter: 0, attendees: 0 });
  });

  it('tells a closed event apart from one that never existed', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await setStartOffset(db, eventId, -1);

    expect(
      (await createRsvp(db, { id: rsvpId(), eventId, userId: members[2].id }))
        .outcome,
    ).toBe('rsvp_closed');
    expect(
      (
        await createRsvp(db, {
          id: rsvpId(),
          eventId: 'evt_never',
          userId: members[2].id,
        })
      ).outcome,
    ).toBe('event_missing');
  });

  it('keeps the going set intact when a member tries to withdraw after the start', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await setStartOffset(db, eventId, 60);
    await createRsvp(db, { id: rsvpId(), eventId, userId: members[3].id });

    await setStartOffset(db, eventId, -1);
    const cancelled = await cancelRsvp(db, {
      eventId,
      userId: members[3].id,
    });

    expect(cancelled.deleted).toBe(false);
    expect(await counters(db, eventId)).toEqual({ counter: 1, attendees: 1 });
  });

  it('still lets a member withdraw a moment before the start', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await setStartOffset(db, eventId, 60);
    await createRsvp(db, { id: rsvpId(), eventId, userId: members[4].id });

    const cancelled = await cancelRsvp(db, {
      eventId,
      userId: members[4].id,
    });

    expect(cancelled.deleted).toBe(true);
    expect(await counters(db, eventId)).toEqual({ counter: 0, attendees: 0 });
  });

  it('leaves the counter and the rows agreeing after a refused withdrawal', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await setStartOffset(db, eventId, 60);
    await createRsvp(db, { id: rsvpId(), eventId, userId: members[0].id });
    await createRsvp(db, { id: rsvpId(), eventId, userId: members[1].id });
    await setStartOffset(db, eventId, -1);

    await Promise.all([
      cancelRsvp(db, { eventId, userId: members[0].id }),
      cancelRsvp(db, { eventId, userId: members[1].id }),
    ]);

    expect(await counters(db, eventId)).toEqual({ counter: 2, attendees: 2 });
  });

  it('does not let a race across the boundary create a seat nobody can release', async () => {
    const db = await setupDb();
    const eventId = await seedEvent(db);
    await setStartOffset(db, eventId, 1);

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const created = await createRsvp(db, {
      id: rsvpId(),
      eventId,
      userId: members[5].id,
    });

    expect(created.outcome).toBe('rsvp_closed');
    expect(await counters(db, eventId)).toEqual({ counter: 0, attendees: 0 });
  });
});
