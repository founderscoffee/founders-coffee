import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  eq,
  eventAttendance,
  scheduledNotifications,
  submitCloseout,
  type Db,
} from '@founders-coffee/db';
import { id } from '@founders-coffee/core';
import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';

import {
  enqueueFeedbackInvitations,
  feedbackInvitationId,
} from './feedback-invitation.js';

describe('feedback invitation fan-out', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('invites attended members once and skips no-shows', async () => {
    const eventId = await pastEvent(db);
    await submitCloseout(db, {
      eventId,
      actorId: HOST_ID,
      outcome: 'held',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      auditId: id('audit'),
    });
    await db.insert(eventAttendance).values([
      {
        id: id('att'),
        eventId,
        userId: MEMBER_ID,
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '1',
        outcome: 'attended',
        recordedByUserId: HOST_ID,
      },
      {
        id: id('att'),
        eventId,
        userId: OTHER_ID,
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '1',
        outcome: 'no_show',
        recordedByUserId: HOST_ID,
      },
    ]);
    const event = {
      id: eventId,
      marketCode: 'DZ',
      title: 'Coffee + Code',
      venue: 'Café',
      slug: 'coffee',
      startsAt: new Date(),
      endsAt: new Date(),
    };
    expect(await enqueueFeedbackInvitations(db, event)).toBe(1);
    expect(await enqueueFeedbackInvitations(db, event)).toBe(0);
    const rows = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.eventId, eventId));
    expect(rows.map((row) => row.id)).toEqual([
      feedbackInvitationId(eventId, MEMBER_ID),
    ]);
    expect(rows[0]?.fallbackChannel).toBe('email');
  });

  it('does not invite after a closeout arrives more than seven days late', async () => {
    const eventId = await pastEvent(db);
    await db.run(
      sql`UPDATE events SET ends_at = unixepoch() - ${8 * 24 * 60 * 60} WHERE id = ${eventId}`,
    );
    await submitCloseout(db, {
      eventId,
      actorId: HOST_ID,
      outcome: 'held',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      auditId: id('audit'),
    });
    await db.insert(eventAttendance).values({
      id: id('att'),
      eventId,
      userId: MEMBER_ID,
      marketCode: 'DZ',
      stateCode: '16',
      cityCode: '1',
      outcome: 'attended',
      recordedByUserId: HOST_ID,
    });

    expect(
      await enqueueFeedbackInvitations(db, {
        id: eventId,
        marketCode: 'DZ',
        title: 'Coffee + Code',
        venue: 'Café',
        slug: 'coffee',
        startsAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      }),
    ).toBe(0);
  });
});
