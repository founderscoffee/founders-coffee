import { beforeEach, describe, expect, it } from 'vitest';

import {
  NOTIFICATION_CLAIM_TIMEOUT_SECONDS,
  NOTIFICATION_MAX_ATTEMPTS,
  claimDueNotifications,
  listPendingNotifications,
  markNotificationSent,
  type Db,
} from '@founders-coffee/db';

import { sweepNotifications } from './notification-sweep.js';
import {
  countingSms,
  enqueue,
  fakeSms,
  providers,
  rowById,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');
const afterClaimTimeout = (from: Date = NOW): Date =>
  new Date(from.getTime() + (NOTIFICATION_CLAIM_TIMEOUT_SECONDS + 1) * 1000);

describe('claiming due notifications', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('moves claimed rows to processing and stamps claimed_at', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });

    const claimed = await claimDueNotifications(db, { limit: 10, now: NOW });

    expect(claimed.map((r) => r.id)).toEqual([rowId]);
    const row = await rowById(db, rowId);
    expect(row?.status).toBe('processing');
    expect(row?.claimedAt?.getTime()).toBe(NOW.getTime());
  });

  it('leaves nothing for a second claim to take', async () => {
    await enqueue(db, { channel: 'sms' });
    await enqueue(db, { channel: 'sms', templateKey: 'reminder_24h' });

    const first = await claimDueNotifications(db, { limit: 10, now: NOW });
    const second = await claimDueNotifications(db, { limit: 10, now: NOW });

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(0);
  });

  it('hides claimed rows from the pending read', async () => {
    await enqueue(db, { channel: 'sms' });
    await claimDueNotifications(db, { limit: 10, now: NOW });

    expect(
      await listPendingNotifications(db, { limit: 10, now: NOW }),
    ).toHaveLength(0);
  });

  it('dispatches each row exactly once across two overlapping sweeps', async () => {
    for (let i = 0; i < 6; i++) {
      await enqueue(db, {
        channel: 'sms',
        templateKey: i % 2 === 0 ? 'reminder_24h' : 'reminder_72h',
      });
    }
    const { provider, sends } = countingSms();

    const [a, b] = await Promise.all([
      sweepNotifications(db, providers({ sms: provider }), NOW),
      sweepNotifications(db, providers({ sms: provider }), NOW),
    ]);

    expect(sends).toHaveLength(6);
    expect(a.selected + b.selected).toBe(6);
    expect(a.sent + b.sent).toBe(6);
  });

  it('does not resolve a row the caller does not hold', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });

    await markNotificationSent(db, { id: rowId });

    expect((await rowById(db, rowId))?.status).toBe('pending');
  });
});

describe('reclaiming abandoned rows', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('leaves a fresh claim alone', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });
    await claimDueNotifications(db, { limit: 10, now: NOW });

    const report = await sweepNotifications(
      db,
      providers(),
      new Date(NOW.getTime() + 30_000),
    );

    expect(report.reclaimed).toBe(0);
    expect((await rowById(db, rowId))?.status).toBe('processing');
  });

  it('returns an abandoned row to pending once the claim expires', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });
    await claimDueNotifications(db, { limit: 10, now: NOW });

    const later = afterClaimTimeout();
    const report = await sweepNotifications(db, providers(), later);

    expect(report.reclaimed).toBe(1);
    const row = await rowById(db, rowId);
    expect(row?.status).toBe('pending');
    expect(row?.attempts).toBe(1);
    expect(row?.claimedAt).toBeNull();
    expect(row?.lastError).toContain('claim_expired');
    expect(row?.sendAt.getTime()).toBeGreaterThan(later.getTime());
  });

  it('delivers a reclaimed row on a later sweep', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });
    await claimDueNotifications(db, { limit: 10, now: NOW });

    const later = afterClaimTimeout();
    await sweepNotifications(db, providers(), later);
    await sweepNotifications(
      db,
      providers(),
      new Date(later.getTime() + 600_000),
    );

    expect((await rowById(db, rowId))?.status).toBe('sent');
  });

  it('spends the attempt budget so a repeatedly dying run cannot reclaim forever', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });

    let at = NOW;
    for (let round = 0; round < NOTIFICATION_MAX_ATTEMPTS; round++) {
      await claimDueNotifications(db, { limit: 10, now: at });
      at = afterClaimTimeout(at);
      await sweepNotifications(db, providers({ sms: fakeSms('ok') }), at);
      at = new Date(at.getTime() + 600_000);
    }

    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.attempts).toBe(NOTIFICATION_MAX_ATTEMPTS);
  });

  it('creates the fallback when the budget is spent by reclaims', async () => {
    await enqueue(db, { channel: 'sms', fallbackChannel: 'email' });

    let at = NOW;
    let created = 0;
    for (let round = 0; round < NOTIFICATION_MAX_ATTEMPTS; round++) {
      await claimDueNotifications(db, { limit: 10, now: at });
      at = afterClaimTimeout(at);
      created += (await sweepNotifications(db, providers(), at))
        .fallbacksCreated;
      at = new Date(at.getTime() + 600_000);
    }

    expect(created).toBe(1);
  });
});

describe('sweep accounting', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('accounts for every row it selected or reclaimed', async () => {
    await enqueue(db, { channel: 'sms' });
    await enqueue(db, { channel: 'push', templateKey: 'reminder_24h' });
    await enqueue(db, { channel: 'email', templateKey: 'reminder_72h' });
    const abandoned = await enqueue(db, {
      channel: 'sms',
      sendAt: new Date('2019-01-01T00:00:00Z'),
    });
    await claimDueNotifications(db, { limit: 1, now: NOW });

    const report = await sweepNotifications(
      db,
      providers({ sms: fakeSms('transient') }),
      afterClaimTimeout(),
    );

    expect(report.reclaimed).toBe(1);
    expect(
      report.sent + report.retrying + report.failed + report.contended,
    ).toBe(report.selected + report.reclaimed);
    expect((await rowById(db, abandoned))?.lastError).toContain(
      'claim_expired',
    );
  });
});

describe('contended resolution', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('keeps the accounting identity when two sweeps race the same stale claim', async () => {
    await enqueue(db, { channel: 'sms' });
    await enqueue(db, { channel: 'sms', templateKey: 'reminder_24h' });
    await claimDueNotifications(db, { limit: 10, now: NOW });
    const later = afterClaimTimeout();

    const reports = await Promise.all([
      sweepNotifications(db, providers(), later),
      sweepNotifications(db, providers(), later),
    ]);

    for (const report of reports) {
      expect(
        report.sent + report.retrying + report.failed + report.contended,
      ).toBe(report.selected + report.reclaimed);
    }
    const advanced = reports.reduce((n, r) => n + r.retrying + r.failed, 0);
    expect(advanced).toBe(2);
  });
});
