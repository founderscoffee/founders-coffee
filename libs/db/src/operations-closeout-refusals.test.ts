import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import {
  correctCloseout,
  getCloseout,
  submitCloseout,
} from './operations-closeout.js';
import {
  HOST_ID,
  OTHER_ID,
  auditRows,
  futureEvent,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';

const submit = (
  db: Db,
  eventId: string,
  overrides: Partial<Parameters<typeof submitCloseout>[1]> = {},
) =>
  submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    auditId: id('aud'),
    ...overrides,
  });

describe('what a refused closeout leaves behind', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('writes no audit entry when a stranger tries to close an event', async () => {
    const eventId = await pastEvent(db);

    await submit(db, eventId, { actorId: OTHER_ID });

    expect(await auditRows(db)).toEqual([]);
  });

  it('writes no audit entry for an event that has not finished', async () => {
    const eventId = await futureEvent(db);

    await submit(db, eventId);

    expect(await auditRows(db)).toEqual([]);
  });

  it('writes no audit entry for an event with no end time', async () => {
    const eventId = await pastEvent(db, { withEndsAt: false });

    await submit(db, eventId);

    expect(await auditRows(db)).toEqual([]);
  });

  it('reads an empty friction list back as an empty list', async () => {
    const eventId = await pastEvent(db);

    await submit(db, eventId);

    expect((await getCloseout(db, eventId))?.hostFriction).toEqual([]);
  });

  it('reads the friction categories back as they were written', async () => {
    const eventId = await pastEvent(db);

    await submit(db, eventId, { hostFriction: ['venue', 'promotion'] });

    expect((await getCloseout(db, eventId))?.hostFriction).toEqual([
      'venue',
      'promotion',
    ]);
  });

  it('keeps the private note a host wrote through a correction', async () => {
    const eventId = await pastEvent(db);
    await submit(db, eventId, {
      hostFriction: ['other_structured'],
      privateNote: 'the terrace was closed',
    });

    await correctCloseout(db, {
      eventId,
      expectedVersion: 0,
      actorId: OTHER_ID,
      outcome: 'held',
      walkInCount: 4,
      wouldHostAgain: true,
      hostFriction: ['other_structured'],
      reason: 'data_entry_error',
      auditId: id('aud'),
    });

    expect((await getCloseout(db, eventId))?.privateNote).toBe(
      'the terrace was closed',
    );
  });
});
