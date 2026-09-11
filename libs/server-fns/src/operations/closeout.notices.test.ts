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

describe('telling everyone a gathering did not happen', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  const noticesFor = (eventId: string) =>
    db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.eventId, eventId));

  const callOff = (eventId: string) =>
    submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId, outcome: 'did_not_happen' },
      attendance: [],
    });

  it('notifies each member who said they were coming', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });

    await callOff(eventId);

    const notices = (await noticesFor(eventId)).filter(
      (row) => row.templateKey === 'event_did_not_happen',
    );
    expect(notices.map((row) => row.userId).sort()).toEqual(
      [MEMBER_ID, OTHER_ID].sort(),
    );
  });

  it('does not tell the host, who just told us', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await callOff(eventId);

    const notices = (await noticesFor(eventId)).filter(
      (row) => row.templateKey === 'event_did_not_happen',
    );
    expect(notices.map((row) => row.userId)).not.toContain(HOST_ID);
  });

  it('says nothing at all when it did happen', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    expect(
      (await noticesFor(eventId)).filter(
        (row) => row.templateKey === 'event_did_not_happen',
      ),
    ).toEqual([]);
  });

  it('carries no link, because there is nothing to do', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await callOff(eventId);

    const notice = (await noticesFor(eventId)).find(
      (row) => row.templateKey === 'event_did_not_happen',
    );
    const payload = notice?.payload as Record<string, unknown>;
    expect(payload.pushUrl).toBe('');
    expect(String(payload.text)).not.toContain('http');
  });

  it('speaks the member’s language, not the market’s', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await db.run(
      sql`UPDATE user SET locale_pref = 'en' WHERE id = ${MEMBER_ID}`,
    );

    await callOff(eventId);

    const notice = (await noticesFor(eventId)).find(
      (row) => row.templateKey === 'event_did_not_happen',
    );
    const payload = notice?.payload as Record<string, unknown>;
    expect(String(payload.pushTitle)).toMatch(/did not happen/i);
  });

  it('does not invite feedback or claim it was held', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await db.run(
      sql`UPDATE user SET locale_pref = 'en' WHERE id = ${MEMBER_ID}`,
    );

    await callOff(eventId);

    const notice = (await noticesFor(eventId)).find(
      (row) => row.templateKey === 'event_did_not_happen',
    );
    const payload = notice?.payload as Record<string, unknown>;
    const body = `${String(payload.pushTitle)} ${String(payload.text)}`;
    expect(body).toMatch(/did not take place|did not happen/i);
    expect(body).not.toMatch(
      /feedback|how did it go|attended it|thank you for/i,
    );
  });

  it('falls back to the market language when the member has no preference', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await callOff(eventId);

    const notice = (await noticesFor(eventId)).find(
      (row) => row.templateKey === 'event_did_not_happen',
    );
    const payload = notice?.payload as Record<string, unknown>;
    expect(String(payload.pushTitle)).toMatch(/[؀-ۿ]/);
  });

  it('writes no attendance row for a gathering that did not happen', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await callOff(eventId);

    expect(await listAttendance(db, eventId)).toEqual([]);
  });
});

describe('an operator correcting a closeout', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  const correction = (eventId: string, expectedVersion: number) => ({
    eventId,
    expectedVersion,
    outcome: 'did_not_happen' as const,
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    reason: 'member_dispute' as const,
  });

  it('rewrites what the host recorded', async () => {
    const eventId = await pastEvent(db);
    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    const result = await correctCloseoutResolver(db, {
      actorId: OTHER_ID,
      accessSubject: 'access|operator',
      input: correction(eventId, 0),
    });

    expect(result.ok).toBe(true);
    expect((await getCloseout(db, eventId))?.outcome).toBe('did_not_happen');
  });

  it('refuses a stale version rather than merging two accounts of one evening', async () => {
    const eventId = await pastEvent(db);
    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    const result = await correctCloseoutResolver(db, {
      actorId: OTHER_ID,
      input: correction(eventId, 99),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('closeout_stale_version');
  });

  it('refuses a gathering that was never closed out', async () => {
    const eventId = await pastEvent(db);

    const result = await correctCloseoutResolver(db, {
      actorId: OTHER_ID,
      input: correction(eventId, 1),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('closeout_not_closed');
  });

  it('records nothing under the host, so an override is never mistaken for a host action', async () => {
    const eventId = await pastEvent(db);
    await submitCloseoutResolver(db, {
      actorId: HOST_ID,
      input: { ...held, eventId },
      attendance: [],
    });

    await correctCloseoutResolver(db, {
      actorId: OTHER_ID,
      accessSubject: 'access|operator',
      input: correction(eventId, 0),
    });

    const audit = await auditRows(db);
    const override = audit.find((row) => row.action === 'closeout_corrected');
    expect(override?.actorUserId).toBe(OTHER_ID);
    expect(override?.accessSubject).toBe('access|operator');
    expect(override?.reasonCode).toBe('member_dispute');
  });
});
