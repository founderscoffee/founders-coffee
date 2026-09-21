import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { recordAttendance } from './operations-attendance.js';
import { submitCloseout } from './operations-closeout.js';
import { saveFeedback } from './operations-feedback.js';
import {
  clearAgedComments,
  listAttendeeHistory,
  listHostCompletionHistory,
  retireAgedOperations,
  withdrawMemberOperations,
} from './operations-retention.js';
import { eventFeedback } from './schema.js';
import {
  HOST_ID,
  MEMBER_ID,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';

const DAY = 24 * 3600;

const heldEventWith = async (db: Db, attendees: readonly string[]) => {
  const eventId = await pastEvent(db, { attendees });
  for (const userId of attendees) {
    await recordAttendance(db, {
      eventId,
      userId,
      hostId: HOST_ID,
      outcome: 'attended',
      rowId: id('att'),
      auditId: id('aud'),
    });
  }
  await submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: true,
    hostFriction: [],
    auditId: id('aud'),
  });
  return eventId;
};

describe('retention', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('clears a comment at twelve months and keeps the rating', async () => {
    const eventId = await heldEventWith(db, [MEMBER_ID]);
    await saveFeedback(db, {
      eventId,
      userId: MEMBER_ID,
      rowId: id('fbk'),
      rating: 'valuable',
      wouldReturn: true,
      comment: 'Great morning',
      commentLanguage: 'en',
    });
    await db.run(
      sql`UPDATE event_feedback SET created_at = unixepoch() - ${400 * DAY} WHERE event_id = ${eventId}`,
    );

    const cleared = await clearAgedComments(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 50,
    });

    expect(cleared).toBe(1);
    const rows = await db
      .select()
      .from(eventFeedback)
      .where(eq(eventFeedback.eventId, eventId));
    expect(rows[0]).toMatchObject({
      comment: null,
      commentLanguage: null,
      valueRating: 'valuable',
    });
  });

  it('leaves a comment younger than twelve months alone', async () => {
    const eventId = await heldEventWith(db, [MEMBER_ID]);
    await saveFeedback(db, {
      eventId,
      userId: MEMBER_ID,
      rowId: id('fbk'),
      rating: 'valuable',
      wouldReturn: true,
      comment: 'Recent',
      commentLanguage: 'en',
    });

    expect(
      await clearAgedComments(db, {
        marketCode: 'DZ',
        now: new Date(),
        limit: 50,
      }),
    ).toBe(0);
  });

  it('retires operations rows past twenty-four months', async () => {
    const eventId = await heldEventWith(db, [MEMBER_ID]);
    await db.run(
      sql`UPDATE event_attendance SET recorded_at = unixepoch() - ${800 * DAY} WHERE event_id = ${eventId}`,
    );
    await db.run(
      sql`UPDATE event_closeouts SET submitted_at = unixepoch() - ${800 * DAY} WHERE event_id = ${eventId}`,
    );

    const report = await retireAgedOperations(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 50,
    });

    expect(report.attendanceDeleted).toBe(1);
    expect(report.closeoutsDeleted).toBe(1);
  });

  it('leaves rows inside the window alone', async () => {
    await heldEventWith(db, [MEMBER_ID]);

    const report = await retireAgedOperations(db, {
      marketCode: 'DZ',
      now: new Date(),
      limit: 50,
    });

    expect(report).toMatchObject({
      attendanceDeleted: 0,
      closeoutsDeleted: 0,
      feedbackDeleted: 0,
    });
  });

  it('takes the member out without un-happening the meetup', async () => {
    const eventId = await heldEventWith(db, [MEMBER_ID]);
    await saveFeedback(db, {
      eventId,
      userId: MEMBER_ID,
      rowId: id('fbk'),
      rating: 'okay',
      wouldReturn: false,
    });

    const removed = await withdrawMemberOperations(db, MEMBER_ID);

    expect(removed).toEqual({ feedbackDeleted: 1, attendanceDeleted: 1 });
    const closeout = await db.run(
      sql`SELECT event_id FROM event_closeouts WHERE event_id = ${eventId}`,
    );
    expect(closeout).toBeTruthy();
  });
});

describe('metric source queries', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('lists a completed event against the host who ran it', async () => {
    await heldEventWith(db, [MEMBER_ID]);

    const history = await listHostCompletionHistory(db, {
      marketCode: 'DZ',
      since: new Date(Date.now() - 90 * DAY * 1000),
    });

    expect(history.map((row) => row.userId)).toEqual([HOST_ID]);
  });

  it('excludes an event that was never closed out', async () => {
    await pastEvent(db, { attendees: [MEMBER_ID] });

    expect(
      await listHostCompletionHistory(db, {
        marketCode: 'DZ',
        since: new Date(Date.now() - 90 * DAY * 1000),
      }),
    ).toEqual([]);
  });

  it('lists an attendee only for events that were held', async () => {
    await heldEventWith(db, [MEMBER_ID]);

    const history = await listAttendeeHistory(db, {
      marketCode: 'DZ',
      since: new Date(Date.now() - 90 * DAY * 1000),
    });

    expect(history.map((row) => row.userId)).toEqual([MEMBER_ID]);
  });
});
