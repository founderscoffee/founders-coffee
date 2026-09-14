import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

import {
  eq,
  events,
  scheduledNotifications,
  type Db,
} from '@founders-coffee/db';

import { createEventWithTelemetry } from './create.js';
import {
  createInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

/**
 * A database whose inserts into one table throw, and which is otherwise itself.
 *
 * Failure is injected at the `Db` seam rather than by mocking the module, so the test exercises the
 * real resolver, the real hook and the real swallow — the thing under test is that a throw down
 * there cannot reach the event row up here.
 */
const failingInsertsInto = (db: Db, table: unknown): Db =>
  new Proxy(db as object, {
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== 'insert' || typeof value !== 'function') return value;
      return (arg: unknown) => {
        if (arg === table) throw new Error('injected insert failure');
        return (value as (a: unknown) => unknown).call(target, arg);
      };
    },
  }) as Db;

const eventRows = (db: Db) => db.select().from(events);

const promptRows = (db: Db, eventId: string) =>
  db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, eventId));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('an intent failure cannot reach the event', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await db.run(sql`DELETE FROM events`);
  });

  it('creates the event anyway when the prompt write throws', async () => {
    const result = await createEventWithTelemetry(
      failingInsertsInto(db, scheduledNotifications),
      testMapProvider,
      null,
      TEST_HOST_ID,
      createInput(),
    );

    expect(result.ok).toBe(true);
    expect(await eventRows(db)).toHaveLength(1);
  });

  it('writes no prompt, rather than a half-written one', async () => {
    const result = await createEventWithTelemetry(
      failingInsertsInto(db, scheduledNotifications),
      testMapProvider,
      null,
      TEST_HOST_ID,
      createInput(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(await promptRows(db, result.data.id)).toEqual([]);
  });

  it('does not duplicate the event when the prompt write throws', async () => {
    await createEventWithTelemetry(
      failingInsertsInto(db, scheduledNotifications),
      testMapProvider,
      null,
      TEST_HOST_ID,
      createInput(),
    );

    expect(await eventRows(db)).toHaveLength(1);
  });

  it('counts the failure, so a market that stops scheduling is alertable', async () => {
    const written = vi.spyOn(env.ANALYTICS, 'writeDataPoint');

    await createEventWithTelemetry(
      failingInsertsInto(db, scheduledNotifications),
      testMapProvider,
      null,
      TEST_HOST_ID,
      createInput(),
    );

    expect(
      written.mock.calls
        .map(([point]) => point as AnalyticsEngineDataPoint)
        .filter((point) => point.blobs?.[0] === 'closeout_intent_failed')
        .map((point) => point.indexes),
    ).toEqual([['DZ']]);
  });

  it('schedules the prompt when nothing is injected', async () => {
    const result = await createEventWithTelemetry(
      db,
      testMapProvider,
      null,
      TEST_HOST_ID,
      createInput(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const rows = await promptRows(db, result.data.id);
      expect(rows.map((r) => r.templateKey)).toContain('closeout_prompt');
    }
  });
});
