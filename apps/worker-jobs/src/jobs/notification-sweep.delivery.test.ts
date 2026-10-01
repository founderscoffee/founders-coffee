import { beforeEach, describe, expect, it } from 'vitest';

import {
  NOTIFICATION_CLAIM_TIMEOUT_SECONDS,
  beginNotificationDispatch,
  claimDueNotifications,
  type Db,
} from '@founders-coffee/db';

import { CHANNEL_SUPPRESSES_DUPLICATES } from './notification-dispatch.js';
import { sweepNotifications } from './notification-sweep.js';
import {
  MEMBER_ID,
  addPushToken,
  allRows,
  countingPush,
  countingSms,
  enqueue,
  fakePush,
  fakeSms,
  providers,
  rowById,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');
const afterClaimTimeout = (from: Date = NOW): Date =>
  new Date(from.getTime() + (NOTIFICATION_CLAIM_TIMEOUT_SECONDS + 1) * 1000);

/** Claim a row and start its dispatch, then abandon it — the shape of a mid-send crash. */
const crashMidDispatch = async (db: Db, rowId: string): Promise<void> => {
  await claimDueNotifications(db, { limit: 10, now: NOW });
  await beginNotificationDispatch(db, { id: rowId, now: NOW });
};

describe('the dispatch marker', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('is set before the provider call and cleared when the row is sent', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });

    await sweepNotifications(db, providers(), NOW);

    const row = await rowById(db, rowId);
    expect(row?.status).toBe('sent');
    expect(row?.dispatchStartedAt).toBeNull();
  });

  it('is cleared when the row fails', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });

    await sweepNotifications(db, providers({ sms: fakeSms('transient') }), NOW);

    const row = await rowById(db, rowId);
    expect(row?.status).toBe('pending');
    expect(row?.dispatchStartedAt).toBeNull();
  });

  it('records a dispatch that never returned', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });
    await crashMidDispatch(db, rowId);

    const row = await rowById(db, rowId);
    expect(row?.status).toBe('processing');
    expect(row?.dispatchStartedAt?.getTime()).toBe(NOW.getTime());
  });
});

describe('a crash between the provider call and the bookkeeping', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('does not resend an SMS the provider may already have accepted', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });
    await crashMidDispatch(db, rowId);
    const { provider, sends } = countingSms();

    const report = await sweepNotifications(
      db,
      providers({ sms: provider }),
      afterClaimTimeout(),
    );

    expect(sends).toHaveLength(0);
    expect(report.unconfirmed).toBe(1);
    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.lastError).toContain('dispatch_unconfirmed');
    expect(row?.lastError).toContain('cannot suppress');
  });

  it('carries the delivery on the fallback channel instead', async () => {
    const rowId = await enqueue(db, {
      channel: 'sms',
      fallbackChannel: 'email',
    });
    await crashMidDispatch(db, rowId);

    const report = await sweepNotifications(
      db,
      providers(),
      afterClaimTimeout(),
    );

    expect(report.fallbacksCreated).toBe(1);
    const fallback = (await allRows(db)).find((r) => r.fallbackOf === rowId);
    expect(fallback?.channel).toBe('email');
  });

  it('does resend a push, because a duplicate is suppressed on that channel', async () => {
    const rowId = await enqueue(db, { channel: 'push' });
    await addPushToken(db, 'tok_dedupe');
    await crashMidDispatch(db, rowId);
    const { provider, sends } = countingPush();

    const later = afterClaimTimeout();
    const report = await sweepNotifications(
      db,
      providers({ push: provider }),
      later,
    );
    expect(report.unconfirmed).toBe(1);
    expect((await rowById(db, rowId))?.status).toBe('pending');

    await sweepNotifications(
      db,
      providers({ push: provider }),
      new Date(later.getTime() + 600_000),
    );

    expect(sends).toHaveLength(1);
    expect(sends[0].dedupeKey).toBe(rowId);
    expect((await rowById(db, rowId))?.status).toBe('sent');
  });

  it('retries normally when the crash happened before any provider call', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });
    await claimDueNotifications(db, { limit: 10, now: NOW });
    const { provider, sends } = countingSms();

    const later = afterClaimTimeout();
    const report = await sweepNotifications(
      db,
      providers({ sms: provider }),
      later,
    );
    expect(report.unconfirmed).toBe(0);
    expect((await rowById(db, rowId))?.lastError).toContain('claim_expired');

    await sweepNotifications(
      db,
      providers({ sms: provider }),
      new Date(later.getTime() + 600_000),
    );
    expect(sends).toHaveLength(1);
  });
});

describe('dedupe keys reach the providers', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('hands the row id to push as its dedupe key', async () => {
    const rowId = await enqueue(db, { channel: 'push' });
    await addPushToken(db, 'tok_a');
    const { provider, sends } = countingPush();

    await sweepNotifications(db, providers({ push: provider }), NOW);

    expect(sends).toEqual([{ token: 'tok_a', dedupeKey: rowId }]);
  });

  it('delivers host RSVP cancellation notices over push', async () => {
    const rowId = await enqueue(db, {
      channel: 'push',
      templateKey: 'rsvp_cancelled',
    });
    await addPushToken(db, 'tok_cancelled');
    const push = countingPush();

    await sweepNotifications(db, providers({ push: push.provider }), NOW);

    expect(push.sends).toEqual([{ token: 'tok_cancelled', dedupeKey: rowId }]);
    expect((await rowById(db, rowId))?.status).toBe('sent');
  });

  it('declares suppression only for channels that can actually do it', () => {
    expect(CHANNEL_SUPPRESSES_DUPLICATES).toEqual({
      push: true,
      email: false,
      sms: false,
    });
  });

  it('keeps the accounting identity when a row is retired unconfirmed', async () => {
    const rowId = await enqueue(db, { channel: 'sms' });
    await crashMidDispatch(db, rowId);
    await enqueue(db, { channel: 'email', templateKey: 'reminder_24h' });

    const report = await sweepNotifications(
      db,
      providers({ push: fakePush('ok') }),
      afterClaimTimeout(),
    );

    expect(
      report.sent + report.retrying + report.failed + report.contended,
    ).toBe(report.selected + report.reclaimed);
    expect(MEMBER_ID).toBeTruthy();
  });
});
