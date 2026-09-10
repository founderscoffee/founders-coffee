import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { recordAttendance } from './operations-attendance.js';
import { submitCloseout } from './operations-closeout.js';
import {
  feedbackTally,
  getFeedback,
  saveFeedback,
} from './operations-feedback.js';
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

const attended = (db: Db, eventId: string, userId = MEMBER_ID) =>
  recordAttendance(db, {
    eventId,
    userId,
    hostId: HOST_ID,
    outcome: 'attended',
    rowId: id('att'),
    auditId: id('aud'),
  });

/** Move the event's end backwards without touching what has already been recorded about it. */
const endedDaysAgo = (db: Db, eventId: string, days: number) =>
  db.run(
    sql`UPDATE events SET ends_at = unixepoch() - ${days * DAY} WHERE id = ${eventId}`,
  );

/** Move a submitted closeout backwards, to separate "closed late" from "asked late". */
const closedDaysAfterEnd = (db: Db, eventId: string, days: number) =>
  db.run(
    sql`UPDATE event_closeouts
        SET submitted_at = (SELECT ends_at FROM events WHERE id = ${eventId}) + ${days * DAY}
        WHERE event_id = ${eventId}`,
  );

const pulse = (db: Db, eventId: string, userId = MEMBER_ID) =>
  saveFeedback(db, {
    eventId,
    userId,
    rowId: id('fbk'),
    rating: 'valuable',
    wouldReturn: true,
  });

describe('saveFeedback', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('takes a pulse from a member who attended a held event', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await closeOut(db, eventId);

    const result = await pulse(db, eventId);

    expect(result.outcome).toBe('saved');
    expect(result.row).toMatchObject({
      valueRating: 'valuable',
      wouldReturn: true,
      marketCode: 'DZ',
    });
  });

  it('refuses a member who was marked as a no-show', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await recordAttendance(db, {
      eventId,
      userId: MEMBER_ID,
      hostId: HOST_ID,
      outcome: 'no_show',
      rowId: id('att'),
      auditId: id('aud'),
    });
    await closeOut(db, eventId);

    expect((await pulse(db, eventId)).outcome).toBe('not_attended');
  });

  it('refuses a member nobody recorded an outcome for', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await closeOut(db, eventId);

    expect((await pulse(db, eventId)).outcome).toBe('not_attended');
  });

  it('refuses before the host has closed the event out', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);

    expect((await pulse(db, eventId)).outcome).toBe('not_invited');
  });

  it('invites nobody when the meetup did not happen', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await submitCloseout(db, {
      eventId,
      actorId: HOST_ID,
      outcome: 'did_not_happen',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      auditId: id('aud'),
    });

    expect((await pulse(db, eventId)).outcome).toBe('not_invited');
  });

  it('updates the pulse a member already left', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await closeOut(db, eventId);
    await pulse(db, eventId);

    const changed = await saveFeedback(db, {
      eventId,
      userId: MEMBER_ID,
      rowId: id('fbk'),
      rating: 'not_valuable',
      wouldReturn: false,
      comment: 'Trop bruyant',
      commentLanguage: 'fr',
    });

    expect(changed.outcome).toBe('saved');
    expect(await getFeedback(db, { eventId, userId: MEMBER_ID })).toMatchObject(
      {
        valueRating: 'not_valuable',
        wouldReturn: false,
        comment: 'Trop bruyant',
        commentLanguage: 'fr',
      },
    );
  });

  it('keeps the comment and its language together', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await closeOut(db, eventId);

    await saveFeedback(db, {
      eventId,
      userId: MEMBER_ID,
      rowId: id('fbk'),
      rating: 'valuable',
      wouldReturn: true,
      comment: 'كان لقاءً رائعًا',
      commentLanguage: 'ar',
    });

    expect(await getFeedback(db, { eventId, userId: MEMBER_ID })).toMatchObject(
      {
        comment: 'كان لقاءً رائعًا',
        commentLanguage: 'ar',
      },
    );
  });
});

describe('the feedback window (§5.20)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('is open on the fourteenth day after the event', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await closeOut(db, eventId);
    await endedDaysAgo(db, eventId, 13);
    await closedDaysAfterEnd(db, eventId, 1);

    expect((await pulse(db, eventId)).outcome).toBe('saved');
  });

  it('is closed on the fifteenth', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await closeOut(db, eventId);
    await endedDaysAgo(db, eventId, 15);
    await closedDaysAfterEnd(db, eventId, 1);

    expect((await pulse(db, eventId)).outcome).toBe('window_closed');
  });

  it('invites nobody when the closeout came more than seven days late', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await closeOut(db, eventId);
    await endedDaysAgo(db, eventId, 9);
    await closedDaysAfterEnd(db, eventId, 8);

    expect((await pulse(db, eventId)).outcome).toBe('not_invited');
  });

  it('cannot be reopened by closing out late, because it is anchored to the event', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await closeOut(db, eventId);
    await endedDaysAgo(db, eventId, 20);
    await closedDaysAfterEnd(db, eventId, 6);

    expect((await pulse(db, eventId)).outcome).toBe('window_closed');
  });

  it('refuses an edit once the window has shut behind a saved pulse', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await attended(db, eventId);
    await closeOut(db, eventId);
    await pulse(db, eventId);

    await endedDaysAgo(db, eventId, 20);
    await closedDaysAfterEnd(db, eventId, 1);
    const late = await saveFeedback(db, {
      eventId,
      userId: MEMBER_ID,
      rowId: id('fbk'),
      rating: 'not_valuable',
      wouldReturn: false,
    });

    expect(late.outcome).toBe('window_closed');
    expect(
      (await getFeedback(db, { eventId, userId: MEMBER_ID }))?.valueRating,
    ).toBe('valuable');
  });
});
