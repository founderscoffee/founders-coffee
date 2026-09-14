import { beforeEach, describe, expect, it } from 'vitest';

import {
  HOST_ID,
  OTHER_ID,
  enableOperations,
  futureEvent,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import { submitCloseout, type Db } from '@founders-coffee/db';

import { readCloseoutStates } from './closeout-state.js';

const close = (db: Db, eventId: string) =>
  submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    auditId: `aud_view_${eventId}`,
  });

const view = async (db: Db, eventIds: readonly string[], hostId = HOST_ID) => {
  const result = await readCloseoutStates(db, { hostId, eventIds });
  if (!result.ok) throw result.error;
  return result.data.map(({ eventId, closed, outcome }) => [
    eventId,
    closed,
    outcome,
  ]);
};

describe('what /activity is told about the host’s own gatherings', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it('offers an elapsed gathering that has not been closed out', async () => {
    const eventId = await pastEvent(db);

    expect(await view(db, [eventId])).toEqual([[eventId, false, null]]);
  });

  it('reports one already closed out, so the host is not asked twice', async () => {
    const eventId = await pastEvent(db);
    await close(db, eventId);

    expect(await view(db, [eventId])).toEqual([[eventId, true, 'held']]);
  });

  it('says nothing at all where the market has operations turned off', async () => {
    const eventId = await pastEvent(db);
    await enableOperations(db, false);

    expect(await view(db, [eventId])).toEqual([]);
  });

  it('says nothing about a gathering still ahead', async () => {
    expect(await view(db, [await futureEvent(db)])).toEqual([]);
  });

  it('says nothing about an event the caller does not host', async () => {
    const eventId = await pastEvent(db);

    expect(await view(db, [eventId], OTHER_ID)).toEqual([]);
  });

  it('makes no request of its own when asked about nothing', async () => {
    expect(await view(db, [])).toEqual([]);
  });
});
