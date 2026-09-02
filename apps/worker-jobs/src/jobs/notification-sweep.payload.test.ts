import { beforeEach, describe, expect, it } from 'vitest';

import type { Db } from '@founders-coffee/db';

import { sweepNotifications } from './notification-sweep.js';
import {
  allRows,
  countingSms,
  enqueue,
  fakePush,
  fakeSms,
  providers,
  rowById,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');

describe('payload validation at the sweep boundary (AR-13)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('retires a row whose payload is missing a required field', async () => {
    const rowId = await enqueue(db, {
      channel: 'sms',
      payload: { smsBody: undefined },
    });
    const { provider, sends } = countingSms();

    const report = await sweepNotifications(
      db,
      providers({ sms: provider }),
      NOW,
    );

    expect(report.invalidPayload).toBe(1);
    expect(sends).toHaveLength(0);
    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.lastError).toContain('invalid_payload');
    expect(row?.lastError).toContain('smsBody');
  });

  it('does not select an invalid row again on the next sweep', async () => {
    await enqueue(db, { channel: 'sms', payload: { phoneNumber: undefined } });

    await sweepNotifications(db, providers(), NOW);
    const second = await sweepNotifications(
      db,
      providers(),
      new Date(NOW.getTime() + 3_600_000),
    );

    expect(second.selected).toBe(0);
  });

  /** An unroutable channel is resolved before parsing, so this row needs a provider to reach it. */
  it('rejects a payload whose type is wrong, not only one that is absent', async () => {
    const rowId = await enqueue(db, {
      channel: 'push',
      payload: { pushTitle: 42 },
    });

    await sweepNotifications(db, providers({ push: fakePush('ok') }), NOW);

    expect((await rowById(db, rowId))?.lastError).toContain('pushTitle');
  });

  it('dispatches a valid row of each channel unchanged', async () => {
    const sms = await enqueue(db, { channel: 'sms' });
    const email = await enqueue(db, {
      channel: 'email',
      templateKey: 'reminder_24h',
    });

    const report = await sweepNotifications(db, providers(), NOW);

    expect(report.invalidPayload).toBe(0);
    expect(report.sent).toBe(2);
    expect((await rowById(db, sms))?.status).toBe('sent');
    expect((await rowById(db, email))?.status).toBe('sent');
  });

  it('keeps the accounting identity when a row is retired as invalid', async () => {
    await enqueue(db, { channel: 'sms', payload: { smsBody: undefined } });
    await enqueue(db, { channel: 'sms', templateKey: 'reminder_24h' });

    const report = await sweepNotifications(db, providers(), NOW);

    expect(
      report.sent + report.retrying + report.failed + report.contended,
    ).toBe(report.selected + report.reclaimed);
  });

  it('gives the email fallback a payload it can actually deliver', async () => {
    const parent = await enqueue(db, {
      channel: 'sms',
      fallbackChannel: 'email',
    });
    await sweepNotifications(db, providers({ sms: fakeSms('permanent') }), NOW);

    const fallback = (await allRows(db)).find((r) => r.fallbackOf === parent);
    expect(fallback?.channel).toBe('email');

    const report = await sweepNotifications(
      db,
      providers(),
      new Date(NOW.getTime() + 60_000),
    );

    expect(report.invalidPayload).toBe(0);
    expect((await rowById(db, fallback?.id ?? ''))?.status).toBe('sent');
  });
});
