import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import {
  listEventsMissingEndTime,
  listOverdueCloseouts,
} from './operations-attention.js';
import { submitCloseout } from './operations-closeout.js';
import { HOST_ID, pastEvent, setupDb } from './operations.fixtures.js';

const submit = (db: Db, eventId: string) =>
  submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    auditId: id('aud'),
  });

describe('attention queries', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('lists an event a day past its end with nothing recorded', async () => {
    const eventId = await pastEvent(db, { endedHoursAgo: 30 });

    const overdue = await listOverdueCloseouts(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 10,
    });

    expect(overdue.map((row) => row.id)).toContain(eventId);
  });

  it('stays quiet for the first day after an event', async () => {
    const eventId = await pastEvent(db, { endedHoursAgo: 2 });

    const overdue = await listOverdueCloseouts(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 10,
    });

    expect(overdue.map((row) => row.id)).not.toContain(eventId);
  });

  it('drops an event from the list once it is closed out', async () => {
    const eventId = await pastEvent(db, { endedHoursAgo: 30 });
    await submit(db, eventId);

    const overdue = await listOverdueCloseouts(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 10,
    });

    expect(overdue.map((row) => row.id)).not.toContain(eventId);
  });

  it('never lists a cancelled event as overdue', async () => {
    const eventId = await pastEvent(db, {
      endedHoursAgo: 30,
      status: 'cancelled',
    });

    const overdue = await listOverdueCloseouts(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 10,
    });

    expect(overdue.map((row) => row.id)).not.toContain(eventId);
  });

  it('separates events with no end time into their own attention list', async () => {
    const legacyId = await pastEvent(db, { withEndsAt: false });
    const normalId = await pastEvent(db, { endedHoursAgo: 30 });

    const missing = await listEventsMissingEndTime(db, {
      marketCode: 'DZ',
      limit: 10,
    });
    const overdue = await listOverdueCloseouts(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 10,
    });

    expect(missing.map((row) => row.id)).toEqual([legacyId]);
    expect(overdue.map((row) => row.id)).toContain(normalId);
    expect(overdue.map((row) => row.id)).not.toContain(legacyId);
  });
});
