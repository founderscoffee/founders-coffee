import { beforeEach, describe, expect, it } from 'vitest';

import { submitCloseout, type Db } from '@founders-coffee/db';
import {
  HOST_ID,
  OTHER_ID,
  enableOperations,
  futureEvent,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';

import { readRepeatEventTemplate } from './repeat.js';

const close = async (
  db: Db,
  eventId: string,
  outcome: 'held' | 'did_not_happen' = 'held',
) => {
  await submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome,
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    auditId: `aud_repeat_${eventId}`,
  });
};

describe('readRepeatEventTemplate', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it('returns only safe, editable fields from a held event', async () => {
    const eventId = await pastEvent(db);
    await close(db, eventId);

    const result = await readRepeatEventTemplate(db, {
      eventId,
      actorId: HOST_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      sourceEventId: eventId,
      marketCode: 'DZ',
      cityCode: '1',
      title: 'Ops fixture 1',
      description: 'An event used to exercise the operations schema.',
      venue: 'Café des Délices, Hydra',
      venueAddress: null,
      latitude: null,
      longitude: null,
    });
    expect(result.data).not.toHaveProperty('startsAt');
    expect(result.data).not.toHaveProperty('endsAt');
    expect(result.data).not.toHaveProperty('rsvps');
    expect(result.data).not.toHaveProperty('slug');
  });

  it('refuses a template for another host', async () => {
    const eventId = await pastEvent(db);
    await close(db, eventId);

    const result = await readRepeatEventTemplate(db, {
      eventId,
      actorId: OTHER_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('repeat_event_not_host');
  });

  it.each([
    ['an upcoming event', () => futureEvent(db)],
    ['an event without a closeout', () => pastEvent(db)],
  ])('refuses %s', async (_label, makeEvent) => {
    const result = await readRepeatEventTemplate(db, {
      eventId: await makeEvent(),
      actorId: HOST_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('repeat_event_not_eligible');
  });

  it('refuses a gathering marked did not happen', async () => {
    const eventId = await pastEvent(db);
    await close(db, eventId, 'did_not_happen');

    const result = await readRepeatEventTemplate(db, {
      eventId,
      actorId: HOST_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('repeat_event_not_eligible');
  });

  it('refuses when community operations are disabled', async () => {
    const eventId = await pastEvent(db);
    await close(db, eventId);
    await enableOperations(db, false);

    const result = await readRepeatEventTemplate(db, {
      eventId,
      actorId: HOST_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('operations_disabled');
  });
});
