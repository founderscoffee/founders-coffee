import { describe, expect, it } from 'vitest';

import { setupDb } from './resolver.fixtures.js';
import {
  apply,
  END,
  GUEST_ID,
  hostAnEvent,
  inviteGuest,
  pendingFor,
  START,
} from './update.fixtures.js';

describe('telling people when the time moves', () => {
  it('says nothing to anyone when only the wording changed', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);

    const result = await apply(db, event, { title: 'Just a better title' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rescheduled).toBe(false);
      expect(result.data.notified).toBe(0);
    }
    expect(await pendingFor(db, event.id, 'event_rescheduled')).toHaveLength(0);
  });

  it('tells everyone still going when the start moves', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);

    const result = await apply(db, event, {
      startsAt: START + 3_600_000,
      endsAt: END + 3_600_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rescheduled).toBe(true);
      expect(result.data.notified).toBe(1);
    }
    const notices = await pendingFor(db, event.id, 'event_rescheduled');
    expect(notices).toHaveLength(1);
    expect(
      notices[0]?.userId,
      'the host already knows what they just did',
    ).toBe(GUEST_ID);
  });

  it('does not confirm a booking the attendee made weeks ago', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = await pendingFor(db, event.id, 'rsvp_confirmation');

    await apply(db, event, {
      startsAt: START + 86_400_000,
      endsAt: END + 86_400_000,
    });

    expect(
      await pendingFor(db, event.id, 'rsvp_confirmation'),
      're-arming the reminders must not re-send the confirmation: the attendee booked long ago, and the reschedule notice is already telling them the one thing that changed',
    ).toHaveLength(before.length);
  });

  it('rewrites the reminders so none of them still describes the old time', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = await pendingFor(db, event.id, 'reminder_24h');
    expect(before.length).toBeGreaterThan(0);

    await apply(db, event, {
      startsAt: START + 86_400_000,
      endsAt: END + 86_400_000,
    });

    const after = await pendingFor(db, event.id, 'reminder_24h');
    expect(
      after.map((row) => row.id),
      'a reminder queued against the old start would arrive early, describing a time that is no longer true',
    ).not.toEqual(before.map((row) => row.id));
  });
});
