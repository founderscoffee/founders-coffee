import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { recordAttendance } from './operations-attendance.js';
import { listAuditForMarket, listAuditForTarget } from './operations-audit.js';
import { submitCloseout } from './operations-closeout.js';
import { listExpiredHostTrust } from './operations-retention.js';
import { setHostTrust } from './operations-trust.js';
import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';

const DAY = 24 * 3600;

const closeOut = (db: Db, eventId: string) =>
  submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: true,
    hostFriction: [],
    auditId: id('aud'),
  });

describe('listAuditForTarget', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('returns the trail for one thing and nothing else', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await closeOut(db, eventId);
    await recordAttendance(db, {
      eventId,
      userId: MEMBER_ID,
      hostId: HOST_ID,
      outcome: 'attended',
      rowId: id('att'),
      auditId: id('aud'),
    });

    const trail = await listAuditForTarget(db, {
      targetType: 'closeout',
      targetId: eventId,
      limit: 10,
    });

    expect(trail).toHaveLength(1);
    expect(trail[0]?.action).toBe('closeout_submitted');
  });

  it('is empty for a target nothing has happened to', async () => {
    expect(
      await listAuditForTarget(db, {
        targetType: 'closeout',
        targetId: 'evt_nothing',
        limit: 10,
      }),
    ).toEqual([]);
  });

  it('returns the newest entry first', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    const mark = (outcome: 'attended' | 'no_show', isCorrection: boolean) =>
      recordAttendance(db, {
        eventId,
        userId: MEMBER_ID,
        hostId: HOST_ID,
        outcome,
        rowId: id('att'),
        auditId: id('aud'),
        isCorrection,
      });
    await mark('no_show', false);
    await db.run(
      sql`UPDATE operations_audit SET created_at = unixepoch() - 60
          WHERE action = 'attendance_recorded'`,
    );
    await mark('attended', true);

    const trail = await listAuditForTarget(db, {
      targetType: 'attendance',
      targetId: `${eventId}:${MEMBER_ID}`,
      limit: 10,
    });

    expect(trail.map((row) => row.action)).toEqual([
      'attendance_corrected',
      'attendance_recorded',
    ]);
  });

  it('honours the limit, so a long trail cannot flood a screen', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    for (const outcome of ['no_show', 'attended', 'no_show'] as const) {
      await recordAttendance(db, {
        eventId,
        userId: MEMBER_ID,
        hostId: HOST_ID,
        outcome,
        rowId: id('att'),
        auditId: id('aud'),
        isCorrection: true,
      });
    }

    expect(
      await listAuditForTarget(db, {
        targetType: 'attendance',
        targetId: `${eventId}:${MEMBER_ID}`,
        limit: 2,
      }),
    ).toHaveLength(2);
  });
});

describe('listAuditForMarket', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('returns what happened in this market since a moment', async () => {
    const eventId = await pastEvent(db);
    await closeOut(db, eventId);

    const trail = await listAuditForMarket(db, {
      marketCode: 'DZ',
      since: new Date(Date.now() - 60_000),
      limit: 10,
    });

    expect(trail.map((row) => row.action)).toEqual(['closeout_submitted']);
  });

  it('excludes anything older than the window', async () => {
    const eventId = await pastEvent(db);
    await closeOut(db, eventId);
    await db.run(
      sql`UPDATE operations_audit SET created_at = unixepoch() - ${10 * DAY}`,
    );

    expect(
      await listAuditForMarket(db, {
        marketCode: 'DZ',
        since: new Date(Date.now() - 60_000),
        limit: 10,
      }),
    ).toEqual([]);
  });

  it('does not leak one market into another', async () => {
    const eventId = await pastEvent(db);
    await closeOut(db, eventId);

    expect(
      await listAuditForMarket(db, {
        marketCode: 'EG',
        since: new Date(Date.now() - 60_000),
        limit: 10,
      }),
    ).toEqual([]);
  });
});

describe('listExpiredHostTrust', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const decide = (userId: string) =>
    setHostTrust(db, {
      marketCode: 'DZ',
      userId,
      status: 'restricted',
      reason: 'policy',
      actorId: OTHER_ID,
      rowId: id('trs'),
      auditId: id('aud'),
    });

  it('lists a decision older than twenty-four months', async () => {
    await decide(HOST_ID);
    await db.run(
      sql`UPDATE host_trust SET updated_at = unixepoch() - ${800 * DAY}`,
    );

    const expired = await listExpiredHostTrust(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 10,
    });

    expect(expired.map((row) => row.userId)).toEqual([HOST_ID]);
  });

  it('leaves a recent decision alone', async () => {
    await decide(HOST_ID);

    expect(
      await listExpiredHostTrust(db, {
        marketCode: 'DZ',
        now: new Date(),
        limit: 10,
      }),
    ).toEqual([]);
  });

  it("lists rather than deletes, because the judgement is CO-09's", async () => {
    await decide(HOST_ID);
    await db.run(
      sql`UPDATE host_trust SET updated_at = unixepoch() - ${800 * DAY}`,
    );

    await listExpiredHostTrust(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 10,
    });

    const rows = await db.all<{ n: number }>(
      sql`SELECT count(*) AS n FROM host_trust`,
    );
    expect(rows[0]?.n).toBe(1);
  });
});
