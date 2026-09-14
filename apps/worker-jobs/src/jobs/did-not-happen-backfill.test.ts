import { beforeEach, describe, expect, it } from 'vitest';

import {
  and,
  eq,
  scheduledNotifications,
  submitCloseout,
  type Db,
} from '@founders-coffee/db';
import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import { enqueueDidNotHappenNotices } from '@founders-coffee/server-fns/did-not-happen';

import { backfillDidNotHappenNotices } from './did-not-happen-backfill.js';

const callOff = (db: Db, eventId: string, outcome = 'did_not_happen') =>
  submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: outcome as 'did_not_happen' | 'held',
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    auditId: `aud_bf_${eventId}`,
  });

const noticesFor = (db: Db, eventId: string) =>
  db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.eventId, eventId),
        eq(scheduledNotifications.templateKey, 'event_did_not_happen'),
      ),
    );

const dropNoticeFor = (db: Db, eventId: string, userId: string) =>
  db
    .delete(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.eventId, eventId),
        eq(scheduledNotifications.userId, userId),
      ),
    )
    .run();

describe('telling the people a called-off gathering never reached', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('writes the notices a fan-out that never ran would have', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });
    await callOff(db, eventId);

    const tally = await backfillDidNotHappenNotices(db);

    expect(tally.notified).toBe(2);
    expect(await noticesFor(db, eventId)).toHaveLength(2);
  });

  it('fills only the gap when the fan-out got partway', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });
    await callOff(db, eventId);
    await enqueueDidNotHappenNotices(db, {
      id: eventId,
      hostId: HOST_ID,
      marketCode: 'DZ',
      title: 'Ops fixture',
      venue: 'Café des Délices, Hydra',
      slug: 'ops-fixture',
      startsAt: new Date(),
      endsAt: new Date(),
    });
    await dropNoticeFor(db, eventId, OTHER_ID);

    const tally = await backfillDidNotHappenNotices(db);

    expect(tally.notified).toBe(1);
    expect(await noticesFor(db, eventId)).toHaveLength(2);
  });

  it('leaves a fan-out that already finished entirely alone', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });
    await callOff(db, eventId);
    await backfillDidNotHappenNotices(db);

    const second = await backfillDidNotHappenNotices(db);

    expect(second.examined).toBe(0);
    expect(await noticesFor(db, eventId)).toHaveLength(2);
  });

  it('ignores a gathering that was held', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await callOff(db, eventId, 'held');

    const tally = await backfillDidNotHappenNotices(db);

    expect(tally.examined).toBe(0);
    expect(await noticesFor(db, eventId)).toEqual([]);
  });

  it('ignores one with no closeout at all', async () => {
    await pastEvent(db, { attendees: [MEMBER_ID] });

    expect((await backfillDidNotHappenNotices(db)).examined).toBe(0);
  });

  it('does not chase a gathering older than the window', async () => {
    const eventId = await pastEvent(db, { endedHoursAgo: 24 * 30 });
    await callOff(db, eventId);

    expect((await backfillDidNotHappenNotices(db)).examined).toBe(0);
  });

  it('never writes a notice for the host who called it off', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await callOff(db, eventId);

    await backfillDidNotHappenNotices(db);

    const rows = await noticesFor(db, eventId);
    expect(rows.map((row) => row.userId)).toEqual([MEMBER_ID]);
  });
});
