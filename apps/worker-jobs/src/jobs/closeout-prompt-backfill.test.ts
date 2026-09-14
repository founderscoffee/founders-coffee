import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import {
  eq,
  scheduledNotifications,
  submitCloseout,
  type Db,
} from '@founders-coffee/db';
import {
  HOST_ID,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import { enqueueCloseoutPrompt } from '@founders-coffee/server-fns/closeout-prompt';

import { backfillCloseoutPrompts } from './closeout-prompt-backfill.js';

const promptsFor = (db: Db, eventId: string) =>
  db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, eventId));

describe('deriving the prompts a creation hook never wrote', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('schedules one for an ended gathering that has none', async () => {
    const eventId = await pastEvent(db);

    const tally = await backfillCloseoutPrompts(db);

    expect(tally.scheduled).toBe(1);
    expect(await promptsFor(db, eventId)).toHaveLength(1);
  });

  it('does not write a second one for a gathering that already has it', async () => {
    const eventId = await pastEvent(db);
    await backfillCloseoutPrompts(db);

    const second = await backfillCloseoutPrompts(db);

    expect(second.scheduled).toBe(0);
    expect(await promptsFor(db, eventId)).toHaveLength(1);
  });

  it('agrees with the creation hook rather than racing it', async () => {
    const eventId = await pastEvent(db);
    await enqueueCloseoutPrompt(db, {
      id: eventId,
      hostId: HOST_ID,
      marketCode: 'DZ',
      title: 'x',
      venue: 'y',
      slug: 'z',
      startsAt: new Date('2099-01-15T18:00:00Z'),
      endsAt: new Date('2099-01-15T19:00:00Z'),
    });

    await backfillCloseoutPrompts(db);

    expect(await promptsFor(db, eventId)).toHaveLength(1);
  });

  it('leaves a gathering that has already been closed out alone', async () => {
    const eventId = await pastEvent(db);
    await submitCloseout(db, {
      eventId,
      actorId: HOST_ID,
      outcome: 'held',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      auditId: 'aud_backfill_1',
    });

    const tally = await backfillCloseoutPrompts(db);

    expect(tally.examined).toBe(0);
    expect(await promptsFor(db, eventId)).toEqual([]);
  });

  it('leaves a cancelled gathering alone', async () => {
    const eventId = await pastEvent(db, { status: 'cancelled' });

    const tally = await backfillCloseoutPrompts(db);

    expect(tally.examined).toBe(0);
    expect(await promptsFor(db, eventId)).toEqual([]);
  });

  it('leaves a gathering with no recorded end alone', async () => {
    const eventId = await pastEvent(db, { withEndsAt: false });

    const tally = await backfillCloseoutPrompts(db);

    expect(tally.examined).toBe(0);
    expect(await promptsFor(db, eventId)).toEqual([]);
  });

  it('does not reach back beyond the window it is bounded to', async () => {
    const eventId = await pastEvent(db);
    await db.run(
      sql`UPDATE events SET starts_at = unixepoch() - 3000000, ends_at = unixepoch() - 2592000 WHERE id = ${eventId}`,
    );

    const tally = await backfillCloseoutPrompts(db);

    expect(tally.examined).toBe(0);
  });

  it('does not reach forward to a gathering still to come', async () => {
    const eventId = await pastEvent(db);
    await db.run(
      sql`UPDATE events SET starts_at = unixepoch() + 3600, ends_at = unixepoch() + 7200 WHERE id = ${eventId}`,
    );

    const tally = await backfillCloseoutPrompts(db);

    expect(tally.examined).toBe(0);
  });
});
