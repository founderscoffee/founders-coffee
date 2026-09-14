import { beforeEach, describe, expect, it } from 'vitest';

import { listCloseoutStates } from './operations-closeout-state.js';
import { submitCloseout } from './operations-closeout.js';
import {
  HOST_ID,
  OTHER_ID,
  futureEvent,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';
import type { Db } from './db.js';

const close = (db: Db, eventId: string) =>
  submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    auditId: `aud_state_${eventId}`,
  });

const idsFrom = async (db: Db, eventIds: readonly string[]) =>
  (await listCloseoutStates(db, { hostId: HOST_ID, eventIds })).map(
    ({ eventId, closed, outcome }) => [eventId, closed, outcome],
  );

describe('what the host may still close out', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('reports an elapsed gathering as open', async () => {
    const eventId = await pastEvent(db);

    expect(await idsFrom(db, [eventId])).toEqual([[eventId, false, null]]);
  });

  it('reports it as closed once it has been closed out', async () => {
    const eventId = await pastEvent(db);
    await close(db, eventId);

    expect(await idsFrom(db, [eventId])).toEqual([[eventId, true, 'held']]);
  });

  it('carries the market, so the caller can apply the flag without a second read', async () => {
    const eventId = await pastEvent(db);

    const states = await listCloseoutStates(db, {
      hostId: HOST_ID,
      eventIds: [eventId],
    });

    expect(states[0]?.marketCode).toBe('DZ');
  });

  it('omits a gathering that has not finished', async () => {
    const eventId = await futureEvent(db);

    expect(await idsFrom(db, [eventId])).toEqual([]);
  });

  it('omits a cancelled gathering', async () => {
    const eventId = await pastEvent(db, { status: 'cancelled' });

    expect(await idsFrom(db, [eventId])).toEqual([]);
  });

  it('omits a gathering with no recorded end, which can never be closed out', async () => {
    const eventId = await pastEvent(db, { withEndsAt: false });

    expect(await idsFrom(db, [eventId])).toEqual([]);
  });

  it('omits somebody else’s gathering, however the id was obtained', async () => {
    const eventId = await pastEvent(db, { hostId: OTHER_ID });

    expect(await idsFrom(db, [eventId])).toEqual([]);
  });

  it('asks nothing of the database when there is nothing to ask about', async () => {
    expect(await idsFrom(db, [])).toEqual([]);
  });

  it('answers for several at once, open and closed together', async () => {
    const open = await pastEvent(db);
    const done = await pastEvent(db);
    await close(db, done);

    const states = await idsFrom(db, [open, done]);

    expect(states).toHaveLength(2);
    expect(states).toContainEqual([open, false, null]);
    expect(states).toContainEqual([done, true, 'held']);
  });
});
