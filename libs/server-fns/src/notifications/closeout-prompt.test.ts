import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { eq, scheduledNotifications, type Db } from '@founders-coffee/db';
import {
  HOST_ID,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';

import { closeoutPromptId, enqueueCloseoutPrompt } from './closeout-prompt.js';

const eventFor = async (db: Db, overrides: Record<string, unknown> = {}) => {
  const id = await pastEvent(db);
  const rows = await db.run(sql`SELECT ends_at FROM events WHERE id = ${id}`);
  void rows;
  return {
    id,
    hostId: HOST_ID,
    marketCode: 'DZ',
    title: 'Coffee + Code',
    venue: 'Café des Délices',
    slug: 'coffee-and-code',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    endsAt: new Date('2099-01-15T19:00:00Z'),
    ...overrides,
  };
};

const promptRows = (db: Db, eventId: string) =>
  db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, eventId));

describe('scheduling the closeout prompt', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('writes one prompt addressed to the host', async () => {
    const event = await eventFor(db);

    expect(await enqueueCloseoutPrompt(db, event)).toBe('scheduled');

    const rows = await promptRows(db, event.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(HOST_ID);
    expect(rows[0]?.templateKey).toBe('closeout_prompt');
    expect(rows[0]?.channel).toBe('push');
    expect(rows[0]?.fallbackChannel).toBe('email');
  });

  it('sends half an hour after the gathering ends, not when it ends', async () => {
    const event = await eventFor(db);

    await enqueueCloseoutPrompt(db, event);

    const sendAt = (await promptRows(db, event.id))[0]?.sendAt as Date;
    expect(sendAt.getTime() - event.endsAt.getTime()).toBe(30 * 60 * 1000);
  });

  it('is a no-op the second time, decided by the database', async () => {
    const event = await eventFor(db);

    expect(await enqueueCloseoutPrompt(db, event)).toBe('scheduled');
    expect(await enqueueCloseoutPrompt(db, event)).toBe('already_scheduled');
    expect(await promptRows(db, event.id)).toHaveLength(1);
  });

  it('derives the row id from the event, so two writers agree without asking', () => {
    expect(closeoutPromptId('evt_abc')).toBe('ntf_co_abc');
    expect(closeoutPromptId('evt_abc')).toBe(closeoutPromptId('evt_abc'));
  });

  it('refuses a gathering with no recorded end rather than inventing one', async () => {
    const event = await eventFor(db, { endsAt: null });

    expect(await enqueueCloseoutPrompt(db, event)).toBe('no_end_time');
    expect(await promptRows(db, event.id)).toEqual([]);
  });

  it('links to the closeout screen, not to the public event page', async () => {
    const event = await eventFor(db);

    await enqueueCloseoutPrompt(db, event);

    const payload = (await promptRows(db, event.id))[0]?.payload as Record<
      string,
      unknown
    >;
    expect(String(payload.pushUrl)).toContain(`/closeout/${event.id}`);
    expect(String(payload.text)).toContain(`/closeout/${event.id}`);
  });

  it('schedules whether or not the market has operations switched on', async () => {
    const event = await eventFor(db);

    expect(await enqueueCloseoutPrompt(db, event)).toBe('scheduled');
  });
});
