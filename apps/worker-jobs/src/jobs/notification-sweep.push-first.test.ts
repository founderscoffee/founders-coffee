import { beforeEach, describe, expect, it } from 'vitest';

import {
  NOTIFICATION_MAX_ATTEMPTS,
  scheduledNotifications,
  sql,
  type Db,
} from '@founders-coffee/db';

import { sweepNotifications } from './notification-sweep.js';
import {
  addPushToken,
  allRows,
  countingPush,
  countingSms,
  enqueue,
  fakePush,
  providers,
  rowById,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');

const pushRow = (db: Db) =>
  enqueue(db, { channel: 'push', fallbackChannel: 'sms' });

const smsFallbackOf = async (db: Db, rowId: string) =>
  (await allRows(db)).find((row) => row.fallbackOf === rowId);

describe('push first, SMS only behind it (CO-02)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('sends no SMS when the push lands', async () => {
    const rowId = await pushRow(db);
    await addPushToken(db, 'device-1');
    const push = countingPush();
    const sms = countingSms();

    await sweepNotifications(
      db,
      providers({ push: push.provider, sms: sms.provider }),
      NOW,
    );

    expect(push.sends).toHaveLength(1);
    expect(sms.sends).toHaveLength(0);
    expect((await rowById(db, rowId))?.status).toBe('sent');
    expect(await smsFallbackOf(db, rowId)).toBeUndefined();
  });

  it('selects SMS when the member has no device to push to', async () => {
    const rowId = await pushRow(db);
    const sms = countingSms();

    await sweepNotifications(db, providers({ sms: sms.provider }), NOW);

    const fallback = await smsFallbackOf(db, rowId);
    expect((await rowById(db, rowId))?.status).toBe('failed');
    expect(fallback?.channel).toBe('sms');

    await sweepNotifications(
      db,
      providers({ sms: sms.provider }),
      new Date(NOW.getTime() + 60_000),
    );

    expect(sms.sends).toHaveLength(1);
    expect((await smsFallbackOf(db, rowId))?.status).toBe('sent');
  });

  it('selects SMS when push keeps failing until its attempts run out', async () => {
    const rowId = await pushRow(db);
    await addPushToken(db, 'device-1');
    const sms = countingSms();

    let at = NOW;
    for (let attempt = 0; attempt < NOTIFICATION_MAX_ATTEMPTS; attempt++) {
      await sweepNotifications(
        db,
        providers({ push: fakePush('err'), sms: sms.provider }),
        at,
      );
      at = new Date(at.getTime() + 3_600_000);
    }

    expect((await rowById(db, rowId))?.status).toBe('failed');
    expect((await smsFallbackOf(db, rowId))?.channel).toBe('sms');
  });

  it('carries the SMS body the push row was written with', async () => {
    const rowId = await pushRow(db);
    const sms = countingSms();

    await sweepNotifications(db, providers({ sms: sms.provider }), NOW);

    const fallback = await smsFallbackOf(db, rowId);
    expect((fallback?.payload as { smsBody?: string })?.smsBody).toBe('body');
  });

  it('leaves no SMS behind a push that was already delivered', async () => {
    const rowId = await pushRow(db);
    await addPushToken(db, 'device-1');
    const sms = countingSms();

    await sweepNotifications(
      db,
      providers({ push: fakePush('ok'), sms: sms.provider }),
      NOW,
    );
    await sweepNotifications(
      db,
      providers({ push: fakePush('ok'), sms: sms.provider }),
      new Date(NOW.getTime() + 60_000),
    );

    expect(sms.sends).toHaveLength(0);
    expect(await allRows(db)).toHaveLength(1);
    expect((await rowById(db, rowId))?.status).toBe('sent');
  });

  it('pushes once when two sweeps run over the same row', async () => {
    await pushRow(db);
    await addPushToken(db, 'device-1');
    const push = countingPush();

    await Promise.all([
      sweepNotifications(db, providers({ push: push.provider }), NOW),
      sweepNotifications(db, providers({ push: push.provider }), NOW),
    ]);

    expect(push.sends).toHaveLength(1);
  });

  it('sends the fallback once even if its row is re-run', async () => {
    const rowId = await pushRow(db);
    const sms = countingSms();
    await sweepNotifications(db, providers({ sms: sms.provider }), NOW);
    const fallback = await smsFallbackOf(db, rowId);

    await sweepNotifications(
      db,
      providers({ sms: sms.provider }),
      new Date(NOW.getTime() + 60_000),
    );
    await sweepNotifications(
      db,
      providers({ sms: sms.provider }),
      new Date(NOW.getTime() + 120_000),
    );

    expect(sms.sends).toHaveLength(1);
    expect((await rowById(db, fallback?.id ?? ''))?.status).toBe('sent');
  });

  it('writes at most one SMS however often the push row fails', async () => {
    const rowId = await pushRow(db);
    await sweepNotifications(db, providers(), NOW);

    await db
      .update(scheduledNotifications)
      .set({ status: 'pending', attempts: 0 })
      .where(sql`id = ${rowId}`)
      .run();
    await sweepNotifications(db, providers(), new Date(NOW.getTime() + 60_000));

    expect(
      (await allRows(db)).filter((r) => r.fallbackOf !== null),
    ).toHaveLength(1);
  });
});
