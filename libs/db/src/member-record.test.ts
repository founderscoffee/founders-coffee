import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { countAttendedMeetups, meetupRecordSince } from './member-record.js';
import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';
import { eventAttendance, eventCloseouts } from './schema.js';

const DAY = 24 * 60 * 60 * 1000;
const PLACE = { marketCode: 'DZ', stateCode: '16', cityCode: '1' } as const;

const closeOut = (
  db: Db,
  eventId: string,
  outcome: 'held' | 'did_not_happen',
) =>
  db
    .insert(eventCloseouts)
    .values({ eventId, ...PLACE, outcome, submittedByUserId: HOST_ID })
    .run();

const mark = (
  db: Db,
  eventId: string,
  userId: string,
  outcome: 'attended' | 'no_show',
) =>
  db
    .insert(eventAttendance)
    .values({
      id: id('att'),
      eventId,
      userId,
      ...PLACE,
      outcome,
      recordedByUserId: HOST_ID,
    })
    .run();

const heldMeetup = async (
  db: Db,
  marks: Readonly<Record<string, 'attended' | 'no_show'>>,
) => {
  const eventId = await pastEvent(db, { attendees: Object.keys(marks) });
  await closeOut(db, eventId, 'held');
  for (const [userId, outcome] of Object.entries(marks))
    await mark(db, eventId, userId, outcome);
  return eventId;
};

const startedDaysAgo = (db: Db, eventId: string, days: number) =>
  db.run(
    sql`UPDATE events SET starts_at = ${Math.floor((Date.now() - days * DAY) / 1000)} WHERE id = ${eventId}`,
  );

describe('how many meetups a member attended (#90)', () => {
  it('counts the meetups hosts recorded them at, and never a no-show', async () => {
    const db = await setupDb();
    await heldMeetup(db, { [MEMBER_ID]: 'attended', [OTHER_ID]: 'no_show' });
    await heldMeetup(db, { [MEMBER_ID]: 'attended', [OTHER_ID]: 'no_show' });

    expect(await countAttendedMeetups(db, MEMBER_ID, new Date())).toBe(2);
    expect(await countAttendedMeetups(db, OTHER_ID, new Date())).toBe(0);
  });

  it('leaves out a meetup its host reported as not happening', async () => {
    const db = await setupDb();
    const eventId = await pastEvent(db, { attendees: [MEMBER_ID] });
    await closeOut(db, eventId, 'did_not_happen');
    await mark(db, eventId, MEMBER_ID, 'attended');

    expect(await countAttendedMeetups(db, MEMBER_ID, new Date())).toBe(0);
  });

  it('counts over the retention period, by when each meetup started', async () => {
    const db = await setupDb();
    const recent = await heldMeetup(db, { [MEMBER_ID]: 'attended' });
    const old = await heldMeetup(db, { [MEMBER_ID]: 'attended' });
    await startedDaysAgo(db, recent, 729);
    await startedDaysAgo(db, old, 731);

    expect(await countAttendedMeetups(db, MEMBER_ID, new Date())).toBe(1);
    expect(
      Math.round((Date.now() - meetupRecordSince(new Date()).getTime()) / DAY),
    ).toBe(730);
  });
});
