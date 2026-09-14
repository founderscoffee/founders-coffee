import { beforeEach, describe, expect, it } from 'vitest';

import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  auditRows,
  enableOperations,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import {
  eq,
  listAttendance,
  scheduledNotifications,
  type Db,
} from '@founders-coffee/db';

import { submitCloseoutResolver } from './closeout.js';

const held = {
  outcome: 'held' as const,
  walkInCount: 0,
  wouldHostAgain: null,
  hostFriction: [],
};

const submit = (
  db: Db,
  eventId: string,
  attendance: readonly { userId: string; outcome: 'attended' | 'no_show' }[],
  outcome: 'held' | 'did_not_happen' = 'held',
) =>
  submitCloseoutResolver(db, {
    actorId: HOST_ID,
    input: { ...held, outcome, eventId },
    attendance,
  });

const notices = (db: Db, eventId: string) =>
  db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, eventId));

describe('a submission that died partway through the roster', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it('lets the retry write the marks the first attempt never reached', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });
    await submit(db, eventId, [{ userId: MEMBER_ID, outcome: 'attended' }]);

    const result = await submit(db, eventId, [
      { userId: MEMBER_ID, outcome: 'attended' },
      { userId: OTHER_ID, outcome: 'no_show' },
    ]);

    expect(result.ok).toBe(true);
    const rows = await listAttendance(db, eventId);
    expect(rows.map((row) => [row.userId, row.outcome]).sort()).toEqual([
      [MEMBER_ID, 'attended'],
      [OTHER_ID, 'no_show'],
    ]);
  });

  it('leaves the trail saying the work happened once', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    const marks = [{ userId: MEMBER_ID, outcome: 'attended' as const }];
    await submit(db, eventId, marks);

    await submit(db, eventId, marks);
    await submit(db, eventId, marks);

    expect((await auditRows(db)).map((row) => row.action)).toEqual([
      'closeout_submitted',
      'attendance_recorded',
    ]);
  });

  it('refuses a retry that submits a different outcome, rather than resuming it', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await submit(db, eventId, []);

    const result = await submit(db, eventId, [], 'did_not_happen');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('closeout_already_closed');
  });

  it('writes no attendance for the outcome it refused', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await submit(db, eventId, [], 'did_not_happen');

    await submit(db, eventId, [{ userId: MEMBER_ID, outcome: 'attended' }]);

    expect(await listAttendance(db, eventId)).toEqual([]);
  });
});

describe('a did-not-happen fan-out that died partway through', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it('re-enqueues the notice a lost recipient never got', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });
    await submit(db, eventId, [], 'did_not_happen');
    const before = await notices(db, eventId);
    await db
      .delete(scheduledNotifications)
      .where(eq(scheduledNotifications.userId, OTHER_ID))
      .run();

    const result = await submit(db, eventId, [], 'did_not_happen');

    expect(result.ok).toBe(true);
    expect(await notices(db, eventId)).toHaveLength(before.length);
  });

  it('does not tell anybody twice when nothing was lost', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });
    await submit(db, eventId, [], 'did_not_happen');
    const before = await notices(db, eventId);

    await submit(db, eventId, [], 'did_not_happen');

    expect(await notices(db, eventId)).toHaveLength(before.length);
  });
});
