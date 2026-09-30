import { beforeEach, describe, expect, it } from 'vitest';

import { ok } from '@founders-coffee/core';
import {
  NOTIFICATION_MAX_ATTEMPTS,
  NOTIFICATION_RETRY_BACKOFF_SECONDS,
  user,
  type Db,
} from '@founders-coffee/db';
import type { EmailProvider } from '@founders-coffee/email';

import { sweepNotifications } from './notification-sweep.js';
import {
  addPushToken,
  allRows,
  enqueue,
  fakeEmail,
  fakePush,
  fakeSms,
  providers,
  rowById,
  setupDb,
  throwingSms,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');

describe('sweep resolves every selected row', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('marks a push row terminal in one sweep when no provider is configured', async () => {
    const rowId = await enqueue(db, { channel: 'push' });

    const report = await sweepNotifications(db, providers(), NOW);

    expect(report).toMatchObject({ selected: 1, unroutable: 1, failed: 1 });
    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.lastError).toContain('no_provider');
  });

  it('leaves no selected row pending with unchanged attempts', async () => {
    const ids = [
      await enqueue(db, { channel: 'push' }),
      await enqueue(db, { channel: 'sms' }),
      await enqueue(db, { channel: 'email' }),
    ];

    await sweepNotifications(
      db,
      providers({ sms: fakeSms('transient'), email: fakeEmail('err') }),
      NOW,
    );

    for (const rowId of ids) {
      const row = await rowById(db, rowId);
      expect(row).toBeDefined();
      const advanced =
        row?.status !== 'pending' ||
        (row.attempts > 0 && row.sendAt.getTime() > NOW.getTime());
      expect(advanced).toBe(true);
    }
  });

  it('resolves a row whose provider throws instead of aborting the sweep', async () => {
    const throwingId = await enqueue(db, { channel: 'sms' });
    const emailId = await enqueue(db, { channel: 'email' });

    const report = await sweepNotifications(
      db,
      providers({ sms: throwingSms() }),
      NOW,
    );

    expect(report.selected).toBe(2);
    expect(report.sent).toBe(1);
    const throwing = await rowById(db, throwingId);
    expect(throwing?.attempts).toBe(1);
    expect(throwing?.lastError).toContain('dispatch_threw');
    expect((await rowById(db, emailId))?.status).toBe('sent');
  });

  it('stores a failed query a provider threw without the values bound to it', async () => {
    const subject = 'Amina saved you a seat by the window';
    const rowId = await enqueue(db, { channel: 'email', payload: { subject } });
    const email: EmailProvider = {
      name: 'writing-email',
      send: async (input) => {
        await db
          .insert(user)
          .values({
            id: 'usr_sweepcopy',
            name: input.subject,
            email: String(input.to),
          })
          .run();
        return ok({ messageId: 'mid' });
      },
    };

    await sweepNotifications(db, providers({ email }), NOW);

    const lastError = (await rowById(db, rowId))?.lastError ?? '';
    expect(lastError).not.toContain('member@sweep.test');
    expect(lastError).not.toContain(subject);
    expect(lastError).toMatch(
      /^dispatch_threw: Failed query: insert into "user" /u,
    );
    expect(lastError).toContain(
      '\ncause: D1_ERROR: UNIQUE constraint failed: user.email',
    );
  });

  it('treats a user with no device tokens as a permanent push failure', async () => {
    const rowId = await enqueue(db, { channel: 'push' });

    await sweepNotifications(db, providers({ push: fakePush('ok') }), NOW);

    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.lastError).toContain('no_live_device');
  });

  it('delivers push when a device token exists', async () => {
    const rowId = await enqueue(db, { channel: 'push' });
    await addPushToken(db, 'tok_a');

    await sweepNotifications(db, providers({ push: fakePush('ok') }), NOW);

    expect((await rowById(db, rowId))?.status).toBe('sent');
  });
});

describe('retry budget and backoff', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('keeps a transient failure pending with a deferred send_at', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });

    const report = await sweepNotifications(
      db,
      providers({ sms: fakeSms('transient') }),
      NOW,
    );

    expect(report.retrying).toBe(1);
    const row = await rowById(db, rowId);
    expect(row?.status).toBe('pending');
    expect(row?.attempts).toBe(1);
    expect(row?.sendAt.getTime()).toBe(
      NOW.getTime() + NOTIFICATION_RETRY_BACKOFF_SECONDS[0] * 1000,
    );
  });

  it('is not re-selected until the backoff elapses', async () => {
    await enqueue(db, { channel: 'sms' });
    await sweepNotifications(db, providers({ sms: fakeSms('transient') }), NOW);

    const tooSoon = await sweepNotifications(
      db,
      providers({ sms: fakeSms('transient') }),
      new Date(NOW.getTime() + 1_000),
    );
    expect(tooSoon.selected).toBe(0);

    const later = await sweepNotifications(
      db,
      providers({ sms: fakeSms('transient') }),
      new Date(
        NOW.getTime() + NOTIFICATION_RETRY_BACKOFF_SECONDS[0] * 1000 + 1_000,
      ),
    );
    expect(later.selected).toBe(1);
  });

  it('fails terminally once the attempt budget is exhausted', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });

    let at = NOW;
    for (let attempt = 0; attempt < NOTIFICATION_MAX_ATTEMPTS; attempt++) {
      await sweepNotifications(
        db,
        providers({ sms: fakeSms('transient') }),
        at,
      );
      at = new Date(at.getTime() + 3_600_000);
    }

    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.attempts).toBe(NOTIFICATION_MAX_ATTEMPTS);
  });

  it('fails immediately on a permanent provider error', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });

    await sweepNotifications(db, providers({ sms: fakeSms('permanent') }), NOW);

    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.attempts).toBe(1);
  });
});

describe('concurrent resolution of one row', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('advances a row once when two sweeps overlap on it', async () => {
    const rowId = await enqueue(db, {
      channel: 'sms',
      fallbackChannel: 'email',
    });

    const reports = await Promise.all([
      sweepNotifications(db, providers({ sms: fakeSms('permanent') }), NOW),
      sweepNotifications(db, providers({ sms: fakeSms('permanent') }), NOW),
    ]);

    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.attempts).toBe(1);
    expect(reports.reduce((n, r) => n + r.fallbacksCreated, 0)).toBe(1);
    expect(
      (await allRows(db)).filter((r) => r.fallbackOf !== null),
    ).toHaveLength(1);
  });
});
