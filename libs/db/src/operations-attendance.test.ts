import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import {
  attendanceTally,
  listAttendance,
  recordAttendance,
} from './operations-attendance.js';
import { cancelRsvp } from './rsvps.js';
import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  auditRows,
  futureEvent,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';

const mark = (
  db: Db,
  eventId: string,
  overrides: Partial<Parameters<typeof recordAttendance>[1]> = {},
) =>
  recordAttendance(db, {
    eventId,
    userId: MEMBER_ID,
    hostId: HOST_ID,
    outcome: 'attended',
    rowId: id('att'),
    auditId: id('aud'),
    ...overrides,
  });

describe('recordAttendance', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('records an outcome for a member who said they were going', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    const result = await mark(db, eventId);

    expect(result.outcome).toBe('recorded');
    expect(result.row).toMatchObject({ outcome: 'attended', marketCode: 'DZ' });
  });

  it('refuses a member who never said they were coming', async () => {
    const eventId = await pastEvent(db);

    const result = await mark(db, eventId, { userId: OTHER_ID });

    expect(result.outcome).toBe('not_eligible');
    expect(await listAttendance(db, eventId)).toEqual([]);
  });

  it('refuses a caller who does not host the event', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    const result = await mark(db, eventId, { hostId: OTHER_ID });

    expect(result.outcome).toBe('not_host');
    expect(await listAttendance(db, eventId)).toEqual([]);
  });

  it('refuses an event that has not finished', async () => {
    const eventId = await futureEvent(db, { attendees: [MEMBER_ID] });

    expect((await mark(db, eventId)).outcome).toBe('not_ended');
  });

  it('refuses an event with no recorded end time', async () => {
    const eventId = await pastEvent(db, {
      withEndsAt: false,
      attendees: [MEMBER_ID],
    });

    expect((await mark(db, eventId)).outcome).toBe('not_ended');
  });

  it('updates rather than duplicating when the same member is marked twice', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await mark(db, eventId, { outcome: 'no_show' });

    await mark(db, eventId, { outcome: 'attended', isCorrection: true });

    const rows = await listAttendance(db, eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe('attended');
  });

  it('copies the geography from the event, not from the caller', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await mark(db, eventId);

    expect((await listAttendance(db, eventId))[0]).toMatchObject({
      marketCode: 'DZ',
      stateCode: '16',
      cityCode: '1',
    });
  });

  it('writes an audit entry naming the outcome', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    await mark(db, eventId, { outcome: 'no_show' });

    const audit = await auditRows(db);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'attendance_recorded',
      targetId: `${eventId}:${MEMBER_ID}`,
      metadata: { after: 'no_show' },
    });
  });

  it('distinguishes a correction from a first record in the audit', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await mark(db, eventId, { outcome: 'no_show' });

    await mark(db, eventId, {
      outcome: 'attended',
      isCorrection: true,
      reason: 'member_dispute',
    });

    const actions = (await auditRows(db)).map((row) => row.action);
    expect(actions).toEqual(['attendance_recorded', 'attendance_corrected']);
  });

  it('writes no audit entry for an outcome it refused', async () => {
    const eventId = await pastEvent(db);

    await mark(db, eventId, { userId: OTHER_ID });

    expect(await auditRows(db)).toEqual([]);
  });

  it('cannot be escaped by cancelling afterwards, because intent froze at the start', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });

    const cancelled = await cancelRsvp(db, { eventId, userId: MEMBER_ID });

    expect(cancelled).toMatchObject({ deleted: false });
    expect((await mark(db, eventId, { outcome: 'no_show' })).outcome).toBe(
      'recorded',
    );
  });
});

describe('attendanceTally', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('counts each outcome separately', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });
    await mark(db, eventId, { userId: MEMBER_ID, outcome: 'attended' });
    await mark(db, eventId, { userId: OTHER_ID, outcome: 'no_show' });

    expect(await attendanceTally(db, eventId)).toEqual({
      attended: 1,
      noShow: 1,
    });
  });

  it('is zero for an event nobody has been marked at', async () => {
    const eventId = await pastEvent(db);

    expect(await attendanceTally(db, eventId)).toEqual({
      attended: 0,
      noShow: 0,
    });
  });

  it('counts a corrected member once, at their final outcome', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await mark(db, eventId, { outcome: 'no_show' });

    await mark(db, eventId, { outcome: 'attended', isCorrection: true });

    expect(await attendanceTally(db, eventId)).toEqual({
      attended: 1,
      noShow: 0,
    });
  });
});
