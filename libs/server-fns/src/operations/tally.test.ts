import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  createRsvp,
  recordAttendance,
  saveFeedback,
  submitCloseout,
  type Db,
} from '@founders-coffee/db';
import {
  EXTRA_MEMBER_IDS,
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';

import { TALLY_FLOOR, readFeedbackTally } from './tally.js';

const RESPONDENTS = EXTRA_MEMBER_IDS;

/** An ended, closed-out gathering whose named members all attended. */
const heldEvent = async (db: Db, members: readonly string[]) => {
  const eventId = await pastEvent(db, { attendees: [HOST_ID, ...members] });
  await submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: true,
    hostFriction: [],
    auditId: id('aud'),
  });
  for (const userId of members)
    await recordAttendance(db, {
      eventId,
      userId,
      hostId: HOST_ID,
      outcome: 'attended',
      rowId: id('att'),
      auditId: id('aud'),
    });
  return eventId;
};

const rate = async (
  db: Db,
  eventId: string,
  userId: string,
  rating: 'valuable' | 'okay' | 'not_valuable',
  wouldReturn: boolean,
) => {
  const result = await saveFeedback(db, {
    eventId,
    userId,
    rowId: id('fbk'),
    rating,
    wouldReturn,
  });
  expect(result.outcome, `${userId} could not leave a pulse`).toBe('saved');
};

describe('the feedback tally a host may read', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('summarises the pulse once enough people have answered', async () => {
    const eventId = await heldEvent(db, RESPONDENTS.slice(0, 3));
    await rate(db, eventId, RESPONDENTS[0], 'valuable', true);
    await rate(db, eventId, RESPONDENTS[1], 'valuable', true);
    await rate(db, eventId, RESPONDENTS[2], 'okay', false);

    const result = await readFeedbackTally(db, {
      eventId,
      actorId: HOST_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.data).toEqual({
        state: 'shown',
        responses: 3,
        wouldReturn: 2,
        valuable: 2,
        okay: 1,
        notValuable: 0,
      });
  });

  it('withholds the counts below the floor rather than hiding them in the page', async () => {
    const eventId = await heldEvent(db, RESPONDENTS.slice(0, 2));
    await rate(db, eventId, RESPONDENTS[0], 'valuable', true);
    await rate(db, eventId, RESPONDENTS[1], 'not_valuable', false);

    const result = await readFeedbackTally(db, { eventId, actorId: HOST_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ state: 'below_floor' });
      expect(
        JSON.stringify(result.data),
        'a suppressed tally must carry no counts at all, or the host reads them in devtools',
      ).not.toMatch(/[1-9]/);
    }
  });

  it('says below_floor for a gathering nobody answered about', async () => {
    const eventId = await heldEvent(db, RESPONDENTS.slice(0, 3));

    const result = await readFeedbackTally(db, { eventId, actorId: HOST_ID });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ state: 'below_floor' });
  });

  it('treats exactly the floor as enough', async () => {
    const eventId = await heldEvent(db, RESPONDENTS.slice(0, TALLY_FLOOR));
    for (const userId of RESPONDENTS.slice(0, TALLY_FLOOR))
      await rate(db, eventId, userId, 'valuable', true);

    const result = await readFeedbackTally(db, { eventId, actorId: HOST_ID });

    if (result.ok) expect(result.data.state).toBe('shown');
  });

  it('refuses anyone who does not host the gathering', async () => {
    const eventId = await heldEvent(db, RESPONDENTS.slice(0, 3));
    for (const userId of RESPONDENTS.slice(0, 3))
      await rate(db, eventId, userId, 'valuable', true);

    for (const actorId of [MEMBER_ID, OTHER_ID, RESPONDENTS[0]]) {
      const result = await readFeedbackTally(db, { eventId, actorId });
      expect(result.ok, `${actorId} was answered`).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('event_not_host');
    }
  });

  it('refuses an event that does not exist', async () => {
    const result = await readFeedbackTally(db, {
      eventId: id('evt'),
      actorId: HOST_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });

  it('leaves the host out of their own summary', async () => {
    const eventId = await heldEvent(db, RESPONDENTS.slice(0, 3));
    await createRsvp(db, { id: id('rsv'), eventId, userId: OTHER_ID });
    for (const userId of RESPONDENTS.slice(0, 3))
      await rate(db, eventId, userId, 'valuable', true);

    const result = await readFeedbackTally(db, { eventId, actorId: HOST_ID });

    if (result.ok && result.data.state === 'shown')
      expect(
        result.data.responses,
        'the host cannot rate their own meetup, so nothing they did can raise this count',
      ).toBe(3);
  });
});
