import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { recordAttendance } from './operations-attendance.js';
import { submitCloseout } from './operations-closeout.js';
import { feedbackTally, saveFeedback } from './operations-feedback.js';
import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
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

const attended = (db: Db, eventId: string, userId = MEMBER_ID) =>
  recordAttendance(db, {
    eventId,
    userId,
    hostId: HOST_ID,
    outcome: 'attended',
    rowId: id('att'),
    auditId: id('aud'),
  });

const pulse = (db: Db, eventId: string, userId = MEMBER_ID) =>
  saveFeedback(db, {
    eventId,
    userId,
    rowId: id('fbk'),
    rating: 'valuable',
    wouldReturn: true,
  });

describe('feedbackTally', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('aggregates without saying who wrote what', async () => {
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID, OTHER_ID] });
    await attended(db, eventId, MEMBER_ID);
    await attended(db, eventId, OTHER_ID);
    await closeOut(db, eventId);
    await pulse(db, eventId, MEMBER_ID);
    await saveFeedback(db, {
      eventId,
      userId: OTHER_ID,
      rowId: id('fbk'),
      rating: 'okay',
      wouldReturn: false,
      comment: 'Fine',
      commentLanguage: 'en',
    });

    const tally = await feedbackTally(db, eventId);

    expect(tally).toEqual({
      responses: 2,
      wouldReturn: 1,
      valuable: 1,
      okay: 1,
      notValuable: 0,
    });
    expect(Object.keys(tally)).not.toContain('comment');
  });

  it('is empty rather than absent for an event nobody answered about', async () => {
    const eventId = await pastEvent(db);

    expect(await feedbackTally(db, eventId)).toEqual({
      responses: 0,
      wouldReturn: 0,
      valuable: 0,
      okay: 0,
      notValuable: 0,
    });
  });
});
