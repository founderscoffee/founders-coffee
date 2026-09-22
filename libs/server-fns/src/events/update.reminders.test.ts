import { describe, expect, it } from 'vitest';

import { setupDb } from './resolver.fixtures.js';
import {
  apply,
  END,
  hostAnEvent,
  inviteGuest,
  pendingFor,
  START,
} from './update.fixtures.js';

const DAY_MS = 86_400_000;

describe('the reminders already queued against an edited meetup', () => {
  it('does not confirm a booking the attendee made weeks ago', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = await pendingFor(db, event.id, 'rsvp_confirmation');

    await apply(db, event, {
      startsAt: START + DAY_MS,
      endsAt: END + DAY_MS,
    });

    expect(
      await pendingFor(db, event.id, 'rsvp_confirmation'),
      're-arming the reminders must not re-send the confirmation: the attendee booked long ago, and the reschedule notice is already telling them the one thing that changed',
    ).toHaveLength(before.length);
  });

  it('rewrites them so none still describes the old time', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = await pendingFor(db, event.id, 'reminder_24h');
    expect(before.length).toBeGreaterThan(0);

    await apply(db, event, {
      startsAt: START + DAY_MS,
      endsAt: END + DAY_MS,
    });

    const after = await pendingFor(db, event.id, 'reminder_24h');
    expect(
      after.map((row) => row.id),
      'a reminder queued against the old start would arrive early, describing a time that is no longer true',
    ).not.toEqual(before.map((row) => row.id));
  });

  it('rewrites them when the cafe is renamed, even though nobody is notified', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = await pendingFor(db, event.id, 'reminder_24h');

    const result = await apply(db, event, { venueName: 'Café Tantonville' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.notice).toBeNull();
    const after = await pendingFor(db, event.id, 'reminder_24h');
    expect(
      after.map((row) => row.id),
      'a reminder renders its text when it is queued, so a quiet edit still leaves two messages holding the old name',
    ).not.toEqual(before.map((row) => row.id));
    expect(JSON.stringify(after[0]?.payload)).toContain('Café Tantonville');
  });

  it('leaves them alone when the change never reaches their text', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);
    const before = await pendingFor(db, event.id, 'reminder_24h');

    await apply(db, event, {
      description: 'A longer description that says more about the evening.',
    });

    expect(
      (await pendingFor(db, event.id, 'reminder_24h')).map((row) => row.id),
      'rewriting the queue on every save would churn rows for a change no reminder mentions',
    ).toEqual(before.map((row) => row.id));
  });
});
