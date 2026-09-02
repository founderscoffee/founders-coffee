import { beforeEach, describe, expect, it } from 'vitest';

import {
  NOTIFICATION_INSERT_COLUMNS,
  NOTIFICATION_MAX_ATTEMPTS,
  cancelNotificationsByEvent,
  listPendingNotifications,
  scheduledNotifications,
  sql,
  type Db,
} from '@founders-coffee/db';

import { sweepNotifications } from './notification-sweep.js';
import {
  EVENT_ID,
  allRows,
  enqueue,
  fakeSms,
  providers,
  rowById,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');

const exhaustBudget = async (db: Db, outcome: 'transient' | 'permanent') => {
  let at = NOW;
  for (let attempt = 0; attempt < NOTIFICATION_MAX_ATTEMPTS; attempt++) {
    await sweepNotifications(db, providers({ sms: fakeSms(outcome) }), at);
    at = new Date(at.getTime() + 3_600_000);
  }
};

describe('email fallback', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('creates the fallback row exactly when the budget is exhausted', async () => {
    const rowId = await enqueue(db, {
      channel: 'sms',
      fallbackChannel: 'email',
    });

    await sweepNotifications(db, providers({ sms: fakeSms('transient') }), NOW);
    expect((await allRows(db)).length).toBe(1);

    await exhaustBudget(db, 'transient');

    const rows = await allRows(db);
    expect(rows.length).toBe(2);
    const fallback = rows.find((r) => r.id !== rowId);
    expect(fallback?.channel).toBe('email');
    expect(fallback?.status).toBe('pending');
    expect(fallback?.fallbackOf).toBe(rowId);
    expect(fallback?.fallbackChannel).toBeNull();
  });

  it('creates the fallback immediately on a permanent failure', async () => {
    const rowId = await enqueue(db, {
      channel: 'sms',
      fallbackChannel: 'email',
    });

    const report = await sweepNotifications(
      db,
      providers({ sms: fakeSms('permanent') }),
      NOW,
    );

    expect(report.fallbacksCreated).toBe(1);
    const rows = await allRows(db);
    expect(rows.find((r) => r.id !== rowId)?.fallbackOf).toBe(rowId);
  });

  it('creates at most one fallback however often the failure path runs', async () => {
    const rowId = await enqueue(db, {
      channel: 'sms',
      fallbackChannel: 'email',
    });
    await sweepNotifications(db, providers({ sms: fakeSms('permanent') }), NOW);

    await db
      .update(scheduledNotifications)
      .set({ status: 'pending', attempts: 0 })
      .where(sql`id = ${rowId}`)
      .run();
    await sweepNotifications(
      db,
      providers({ sms: fakeSms('permanent') }),
      new Date(NOW.getTime() + 60_000),
    );

    const fallbacks = (await allRows(db)).filter((r) => r.fallbackOf !== null);
    expect(fallbacks).toHaveLength(1);
  });

  it('delivers the fallback on the next sweep', async () => {
    await enqueue(db, { channel: 'sms', fallbackChannel: 'email' });
    await sweepNotifications(db, providers({ sms: fakeSms('permanent') }), NOW);

    await sweepNotifications(
      db,
      providers({ sms: fakeSms('permanent') }),
      new Date(NOW.getTime() + 60_000),
    );

    const fallback = (await allRows(db)).find((r) => r.fallbackOf !== null);
    expect(fallback?.status).toBe('sent');
  });

  it('creates no fallback when the row has no fallback channel', async () => {
    await enqueue(db, { channel: 'sms' });
    await sweepNotifications(db, providers({ sms: fakeSms('permanent') }), NOW);
    expect((await allRows(db)).length).toBe(1);
  });

  it('allows many rows to coexist with a null fallback_of', async () => {
    for (let i = 0; i < 5; i++) await enqueue(db, { channel: 'sms' });
    const rows = await allRows(db);
    expect(rows.filter((r) => r.fallbackOf === null)).toHaveLength(5);
  });
});

describe('selection window cannot be starved', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  /**
   * Deliberately long: it enqueues a full `SWEEP_LIMIT` window and reads every row back, which is
   * several hundred D1 round trips. The window size is the point — a smaller one would not prove
   * the window can be cleared — so the timeout gives way rather than the coverage.
   */
  it('clears a full window of unroutable rows and reaches the next row', async () => {
    const stuck: string[] = [];
    for (let i = 0; i < 100; i++) {
      stuck.push(
        await enqueue(db, {
          channel: 'push',
          sendAt: new Date('2020-01-01T00:00:00Z'),
        }),
      );
    }
    const smsId = await enqueue(db, {
      channel: 'sms',
      sendAt: new Date('2020-06-01T00:00:00Z'),
    });

    const first = await sweepNotifications(db, providers(), NOW);
    expect(first.selected).toBe(100);
    expect(first.unroutable).toBe(100);
    expect((await rowById(db, smsId))?.status).toBe('pending');

    const second = await sweepNotifications(db, providers(), NOW);
    expect(second.selected).toBe(1);
    expect((await rowById(db, smsId))?.status).toBe('sent');
    for (const rowId of stuck) {
      expect((await rowById(db, rowId))?.status).toBe('failed');
    }
  }, 30_000);

  it('selects the oldest due rows first', async () => {
    const newer = await enqueue(db, {
      sendAt: new Date('2021-01-01T00:00:00Z'),
    });
    const older = await enqueue(db, {
      sendAt: new Date('2020-01-01T00:00:00Z'),
    });

    const selected = await listPendingNotifications(db, {
      limit: 10,
      now: NOW,
    });
    expect(selected.map((r) => r.id)).toEqual([older, newer]);
  });
});

describe('cancellation is distinguishable from failure', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('marks cancelled rows cancelled, not failed', async () => {
    const failing = await enqueue(db, { channel: 'sms' });
    const notYetDue = await enqueue(db, {
      channel: 'sms',
      templateKey: 'reminder_24h',
      sendAt: new Date('2099-01-01T00:00:00Z'),
    });

    await sweepNotifications(db, providers({ sms: fakeSms('permanent') }), NOW);
    expect((await rowById(db, failing))?.status).toBe('failed');

    const count = await cancelNotificationsByEvent(db, { eventId: EVENT_ID });

    expect(count).toBe(1);
    expect((await rowById(db, notYetDue))?.status).toBe('cancelled');
    expect((await rowById(db, failing))?.status).toBe('failed');
  });

  it('does not re-select a cancelled row', async () => {
    await enqueue(db, { channel: 'sms' });
    await cancelNotificationsByEvent(db, { eventId: EVENT_ID });

    const report = await sweepNotifications(db, providers(), NOW);
    expect(report.selected).toBe(0);
  });
});

describe('notification insert column contract', () => {
  it('matches the column list Drizzle generates', async () => {
    const db = await setupDb();
    const generated = db
      .insert(scheduledNotifications)
      .select(sql`SELECT 1`)
      .toSQL()
      .sql.match(/\(([^)]*)\)/)?.[1];
    const columns = (generated ?? '')
      .split(',')
      .map((c) => c.trim().replace(/"/g, ''));
    expect(columns).toEqual([...NOTIFICATION_INSERT_COLUMNS]);
  });
});
