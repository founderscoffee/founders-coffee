import { beforeEach, describe, expect, it } from 'vitest';
import { id } from '@founders-coffee/core';
import {
  eventCloseouts,
  recordAttendance,
  submitCloseout,
  type Db,
} from '@founders-coffee/db';
import { eq } from 'drizzle-orm';
import {
  HOST_ID,
  MEMBER_ID,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';

import { readFeedback, submitFeedbackResolver } from './feedback.js';

describe('CO-06 feedback server flow', () => {
  let db: Db;
  let eventId: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    const closed = await submitCloseout(db, {
      eventId,
      actorId: HOST_ID,
      outcome: 'held',
      walkInCount: 0,
      wouldHostAgain: true,
      hostFriction: [],
      auditId: id('aud'),
    });
    expect(closed.outcome).toBe('submitted');
    await recordAttendance(db, {
      eventId,
      userId: MEMBER_ID,
      hostId: HOST_ID,
      outcome: 'attended',
      rowId: id('att'),
      auditId: id('aud'),
    });
  });

  it('only exposes a ready feedback view to an attended member', async () => {
    const result = await readFeedback(db, { eventId, userId: MEMBER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('ready');
      expect(result.data.feedback).toBeNull();
    }
  });

  it('saves and updates one pulse', async () => {
    const first = await submitFeedbackResolver(db, {
      userId: MEMBER_ID,
      input: {
        eventId,
        rating: 'valuable',
        wouldReturn: true,
        comment: undefined,
      },
    });
    expect(first.ok).toBe(true);
    const second = await submitFeedbackResolver(db, {
      userId: MEMBER_ID,
      input: {
        eventId,
        rating: 'okay',
        wouldReturn: false,
        comment: undefined,
      },
    });
    expect(second.ok).toBe(true);
    const view = await readFeedback(db, { eventId, userId: MEMBER_ID });
    if (view.ok) expect(view.data.feedback?.valueRating).toBe('okay');
  });

  it('refuses a no-show', async () => {
    const otherEvent = await pastEvent(db, { attendees: [MEMBER_ID] });
    await submitCloseout(db, {
      eventId: otherEvent,
      actorId: HOST_ID,
      outcome: 'held',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      auditId: id('aud'),
    });
    const refusal = await readFeedback(db, {
      eventId: otherEvent,
      userId: MEMBER_ID,
    });
    expect(refusal.ok).toBe(false);
  });

  it('does not reopen a saved pulse after the event is marked did-not-happen', async () => {
    const saved = await submitFeedbackResolver(db, {
      userId: MEMBER_ID,
      input: {
        eventId,
        rating: 'valuable',
        wouldReturn: true,
        comment: undefined,
      },
    });
    expect(saved.ok).toBe(true);
    await db
      .update(eventCloseouts)
      .set({ outcome: 'did_not_happen' })
      .where(eq(eventCloseouts.eventId, eventId));

    const view = await readFeedback(db, { eventId, userId: MEMBER_ID });
    expect(view.ok).toBe(true);
    if (view.ok) expect(view.data.status).toBe('window_closed');
  });
});
