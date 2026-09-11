import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  auditRows,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import {
  eq,
  getCloseout,
  listAttendance,
  scheduledNotifications,
  type Db,
} from '@founders-coffee/db';

import {
  correctCloseoutResolver,
  readCloseout,
  submitCloseoutResolver,
} from './closeout.js';

/**
 * Turn the market flag on the way the product would.
 *
 * `json_set(..., 1)` writes the JSON number one, and `communityOperationsEnabled` compares against
 * `true` — deliberately, so a stray number or an absent key resolves to off. The helper therefore
 * has to write a JSON boolean, which is what `json('true')` produces.
 */
const enableOperations = (db: Db, on = true) =>
  db.run(
    sql`UPDATE markets
        SET feature_flags = json_set(
          coalesce(feature_flags, '{}'),
          '$.communityOperations',
          json(${on ? 'true' : 'false'})
        )
        WHERE code = 'DZ'`,
  );

const held = {
  outcome: 'held' as const,
  walkInCount: 0,
  wouldHostAgain: null,
  hostFriction: [],
};

describe('reading a closeout', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it('gives the host the going roster to mark', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    const result = await readCloseout(db, { eventId, actorId: HOST_ID });

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.data.roster.map((m) => m.userId)).toEqual([MEMBER_ID]);
  });

  it('refuses somebody who does not host the gathering', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    const result = await readCloseout(db, { eventId, actorId: OTHER_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('closeout_not_host');
  });

  it('refuses while the market has operations switched off', async () => {
    const eventId = await pastEvent(db);
    await enableOperations(db, false);

    const result = await readCloseout(db, { eventId, actorId: HOST_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('operations_disabled');
  });

  it('refuses a legacy event with no recorded end, before the form is filled in', async () => {
    const eventId = await pastEvent(db, { withEndsAt: false });

    const result = await readCloseout(db, { eventId, actorId: HOST_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('closeout_no_end_time');
  });

  it('refuses an event that does not exist rather than answering emptily', async () => {
    const result = await readCloseout(db, {
      eventId: 'evt_nothing',
      actorId: HOST_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });
});

describe('submitting a closeout', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it('records the outcome and who came, in one call', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    const result = await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [{ userId: MEMBER_ID, outcome: 'attended' }],
    });

    expect(result.ok).toBe(true);
    expect((await getCloseout(db, eventId))?.outcome).toBe('held');
    expect(await listAttendance(db, eventId)).toHaveLength(1);
  });

  it('refuses somebody who does not host the gathering', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    const result = await submitCloseoutResolver(db, {
      actorId: OTHER_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('closeout_not_host');
    expect(await getCloseout(db, eventId)).toBeUndefined();
  });

  it('refuses the write, not only the read, while operations are off', async () => {
    const eventId = await pastEvent(db);
    await enableOperations(db, false);

    const result = await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('operations_disabled');
    expect(await getCloseout(db, eventId)).toBeUndefined();
  });

  it('refuses a gathering that has not finished', async () => {
    const eventId = await pastEvent(db, { endedHoursAgo: -4 });

    const result = await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('closeout_not_ended');
  });

  it('refuses a second submission rather than overwriting the first', async () => {
    const eventId = await pastEvent(db);
    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    const again = await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('closeout_already_closed');
  });

  it('refuses a cancelled gathering', async () => {
    const eventId = await pastEvent(db, { status: 'cancelled' });

    const result = await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('closeout_event_cancelled');
  });

  it('reports a forged name rather than recording it', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    const result = await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [{ userId: OTHER_ID, outcome: 'attended' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.refusedMarks).toEqual([OTHER_ID]);
    expect(await listAttendance(db, eventId)).toEqual([]);
  });

  it('records nobody when the gathering did not happen', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId, outcome: 'did_not_happen' },
      attendance: [{ userId: MEMBER_ID, outcome: 'attended' }],
    });

    expect(await listAttendance(db, eventId)).toEqual([]);
  });

  it('derives the totals rather than taking them from the caller', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId, walkInCount: 3 },
      attendance: [{ userId: MEMBER_ID, outcome: 'attended' }],
    });

    const view = await readCloseout(db, { eventId, actorId: HOST_ID });

    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(view.data.registeredAttended).toBe(1);
      expect(view.data.totalAttended).toBe(4);
    }
  });
});
