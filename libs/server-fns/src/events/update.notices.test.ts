import { describe, expect, it } from 'vitest';

import { getEvent } from '@founders-coffee/db';

import { setupDb } from './resolver.fixtures.js';
import {
  ACROSS_TOWN,
  apply,
  END,
  GUEST_ID,
  hostAnEvent,
  hostAnEventInAlgiers,
  inviteGuest,
  pendingFor,
  SAME_DOORWAY,
  START,
  unpinnedEventInAlgiers,
} from './update.fixtures.js';

describe('an edit nobody needs to hear about', () => {
  it('says nothing to anyone when only the wording changed', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);
    await inviteGuest(db, event);

    const result = await apply(db, event, { title: 'Just a better title' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.notice).toBeNull();
      expect(result.data.notified).toBe(0);
    }
    expect(await pendingFor(db, event.id, 'event_rescheduled')).toHaveLength(0);
    expect(await pendingFor(db, event.id, 'event_relocated')).toHaveLength(0);
  });

  it('keeps a pin nudged onto the right doorway to itself', async () => {
    const db = await setupDb();
    const event = await hostAnEventInAlgiers(db);
    await inviteGuest(db, event);

    const result = await apply(db, event, { ...SAME_DOORWAY });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.notice).toBeNull();
    expect(
      (await getEvent(db, event.id))?.latitude,
      'the better point is still worth storing; it is only not worth a message',
    ).toBe(SAME_DOORWAY.latitude);
    expect(await pendingFor(db, event.id, 'event_relocated')).toHaveLength(0);
  });

  it('treats the first pin on a meetup that never had one as no move at all', async () => {
    const db = await setupDb();
    const event = await unpinnedEventInAlgiers(db);
    await inviteGuest(db, event);
    expect(event.latitude).toBeNull();

    const result = await apply(db, event, { ...ACROSS_TOWN });

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(
        result.data.notice,
        'the cafe named on the page has not changed; the host has only said where it is for the first time',
      ).toBeNull();
    expect((await getEvent(db, event.id))?.latitude).toBe(ACROSS_TOWN.latitude);
  });
});

describe('an edit that changes the plan', () => {
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
      expect(result.data.notice).toBe('event_rescheduled');
      expect(result.data.notified).toBe(1);
    }
    const notices = await pendingFor(db, event.id, 'event_rescheduled');
    expect(notices).toHaveLength(1);
    expect(
      notices[0]?.userId,
      'the host already knows what they just did',
    ).toBe(GUEST_ID);
  });

  it('tells everyone still going when the cafe moves across town', async () => {
    const db = await setupDb();
    const event = await hostAnEventInAlgiers(db);
    await inviteGuest(db, event);

    const result = await apply(db, event, { ...ACROSS_TOWN });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.data.notice,
        'somebody walking to the old address has to be told, and a push headed "new time" would send them looking for a change that is not there',
      ).toBe('event_relocated');
      expect(result.data.notified).toBe(1);
    }
    expect(await pendingFor(db, event.id, 'event_relocated')).toHaveLength(1);
  });

  it('gives the new address, not a name the host may not have touched', async () => {
    const db = await setupDb();
    const event = await hostAnEventInAlgiers(db);
    await inviteGuest(db, event);

    await apply(db, event, { ...ACROSS_TOWN });

    const [notice] = await pendingFor(db, event.id, 'event_relocated');
    expect(
      JSON.stringify(notice?.payload),
      'a host who drops a pin on the same cafe keeps its name, so a notice built from the name alone would announce a move to where the reader already thinks they are going',
    ).toContain('12 Rue des Entrepreneurs');
  });

  it('sends one message when the time and the place both move', async () => {
    const db = await setupDb();
    const event = await hostAnEventInAlgiers(db);
    await inviteGuest(db, event);

    const result = await apply(db, event, {
      ...ACROSS_TOWN,
      startsAt: START + 3_600_000,
      endsAt: END + 3_600_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(
        result.data.notified,
        'moving the evening and the cafe is one change of plan, not two, and the reschedule copy names the new venue as well',
      ).toBe(1);
    expect(await pendingFor(db, event.id, 'event_rescheduled')).toHaveLength(1);
    expect(await pendingFor(db, event.id, 'event_relocated')).toHaveLength(0);
  });
});
