import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { recordAttendance } from './operations-attendance.js';
import { submitCloseout } from './operations-closeout.js';
import {
  getFeedback,
  getFeedbackEligibility,
  saveFeedback,
} from './operations-feedback.js';
import { feedbackTally } from './operations-feedback-tally.js';
import { eventAttendance, eventFeedback } from './schema.js';
import {
  HOST_ID,
  MEMBER_ID,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';

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

const attended = (db: Db, eventId: string, userId: string) =>
  recordAttendance(db, {
    eventId,
    userId,
    hostId: HOST_ID,
    outcome: 'attended',
    rowId: id('att'),
    auditId: id('aud'),
  });

const pulse = (db: Db, eventId: string, userId: string) =>
  saveFeedback(db, {
    eventId,
    userId,
    rowId: id('fbk'),
    rating: 'valuable',
    wouldReturn: true,
  });

/** Proof the premise holds, so a fixture that silently records nothing cannot pass this by default. */
const attendanceOutcome = async (db: Db, eventId: string, userId: string) => {
  const rows = await db
    .select({ outcome: eventAttendance.outcome })
    .from(eventAttendance)
    .where(
      and(
        eq(eventAttendance.eventId, eventId),
        eq(eventAttendance.userId, userId),
      ),
    )
    .limit(1);
  return rows[0]?.outcome;
};

/** A row of the shape the product wrote before the guard existed. */
const plantSelfRating = (db: Db, eventId: string) =>
  db
    .insert(eventFeedback)
    .values({
      id: id('fbk'),
      eventId,
      userId: HOST_ID,
      marketCode: 'DZ',
      stateCode: '16',
      cityCode: '1',
      valueRating: 'valuable',
      wouldReturn: true,
    })
    .run();

describe('a host rating their own meetup', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('is refused the write, even though they are marked as having attended', async () => {
    const eventId = await pastEvent(db, { attendees: [HOST_ID, MEMBER_ID] });
    await attended(db, eventId, HOST_ID);
    await attended(db, eventId, MEMBER_ID);
    await closeOut(db, eventId);
    expect(
      await attendanceOutcome(db, eventId, HOST_ID),
      'the host has to be genuinely marked attended, or this asserts nothing',
    ).toBe('attended');

    const result = await pulse(db, eventId, HOST_ID);

    expect(
      result.outcome,
      'the host marks their own attendance in the closeout, so the attendance clause alone lets them rate their own meetup',
    ).toBe('is_host');
    expect(await getFeedback(db, { eventId, userId: HOST_ID })).toBeUndefined();
  });

  it('is told they are the host, not that they did not attend', async () => {
    const eventId = await pastEvent(db, { attendees: [HOST_ID, MEMBER_ID] });
    await attended(db, eventId, MEMBER_ID);
    await closeOut(db, eventId);

    const result = await pulse(db, eventId, HOST_ID);

    expect(
      result.outcome,
      'a host with no attendance row is still the host; answering not_attended states something false about them',
    ).toBe('is_host');
  });

  it('is never offered the form, because eligibility says so first', async () => {
    const eventId = await pastEvent(db, { attendees: [HOST_ID, MEMBER_ID] });
    await attended(db, eventId, HOST_ID);
    await closeOut(db, eventId);

    expect(await getFeedbackEligibility(db, { eventId, userId: HOST_ID })).toBe(
      'is_host',
    );
  });

  it('does not count towards the tally when the row predates the guard', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId, MEMBER_ID);
    await closeOut(db, eventId);
    await pulse(db, eventId, MEMBER_ID);
    await plantSelfRating(db, eventId);

    expect(
      await feedbackTally(db, eventId),
      'rows written before the guard are only separable by joining back to events.host_id, and the tally is the one place that matters',
    ).toEqual({
      responses: 1,
      wouldReturn: 1,
      valuable: 1,
      okay: 0,
      notValuable: 0,
    });
  });
});

describe('an attendee who is not the host', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('still leaves a pulse and still counts', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId, MEMBER_ID);
    await closeOut(db, eventId);

    expect((await pulse(db, eventId, MEMBER_ID)).outcome).toBe('saved');
    expect(
      await getFeedbackEligibility(db, { eventId, userId: MEMBER_ID }),
    ).toBe('ready');
    expect((await feedbackTally(db, eventId)).responses).toBe(1);
  });
});
