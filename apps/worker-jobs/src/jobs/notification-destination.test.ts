import { describe, expect, it } from 'vitest';

import {
  createDb,
  eq,
  pushSessionLinks,
  session,
  user,
  type Db,
} from '@founders-coffee/db';
import { env } from 'cloudflare:workers';

import { sweepNotifications } from './notification-sweep.js';
import {
  MEMBER_ID,
  MEMBER_PHONE,
  addPushToken,
  allRows,
  countingPush,
  countingSms,
  enqueue,
  providers,
  rowById,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const LIVE = new Date('2099-01-01T00:00:00Z');
const EXPIRED = new Date('2020-01-01T00:00:00Z');

const withMember = (db: Db, change: Record<string, unknown>) =>
  db.update(user).set(change).where(eq(user.id, MEMBER_ID)).run();

const linkDevice = async (
  db: Db,
  token: string,
  sessionId: string,
  expiresAt: Date,
) => {
  await db
    .insert(session)
    .values({
      id: sessionId,
      userId: MEMBER_ID,
      token: `tok_${sessionId}`,
      expiresAt,
    })
    .onConflictDoNothing()
    .run();
  await db
    .insert(pushSessionLinks)
    .values({
      subscriptionId: `push_${token}`,
      sessionId,
      userId: MEMBER_ID,
    })
    .onConflictDoNothing()
    .run();
};

describe('PF-07a — the destination is resolved at send time', () => {
  it('sends to the number the member has now, not the one the row was written with', async () => {
    const db = await setupDb();
    await enqueue(db);
    await withMember(db, { phoneNumber: '+213699999999' });
    const sms = countingSms();

    await sweepNotifications(db, providers({ sms: sms.provider }), NOW);

    expect(sms.sends).toEqual(['+213699999999']);
    expect(sms.sends).not.toContain(MEMBER_PHONE);
  });

  it('drops a message to a number the member has removed', async () => {
    const db = await setupDb();
    const rowId = await enqueue(db);
    await withMember(db, { phoneNumber: null, phoneNumberVerified: false });
    const sms = countingSms();

    await sweepNotifications(db, providers({ sms: sms.provider }), NOW);

    expect(sms.sends).toEqual([]);
    const row = await rowById(db, rowId);
    expect(row?.status).toBe('failed');
    expect(row?.lastError).toContain('phone_number_removed');
  });

  it('will not send to a number the member has not verified', async () => {
    const db = await setupDb();
    const rowId = await enqueue(db);
    await withMember(db, { phoneNumberVerified: false });
    const sms = countingSms();

    await sweepNotifications(db, providers({ sms: sms.provider }), NOW);

    expect(sms.sends).toEqual([]);
    expect((await rowById(db, rowId))?.lastError).toContain(
      'phone_number_unverified',
    );
  });

  it.each([['closing'], ['deleted']])(
    'delivers nothing at all to a %s account',
    async (accountState) => {
      const db = await setupDb();
      const rowId = await enqueue(db, { channel: 'email' });
      await withMember(db, { accountState });
      const sms = countingSms();

      await sweepNotifications(db, providers({ sms: sms.provider }), NOW);

      const row = await rowById(db, rowId);
      expect(row?.status).toBe('failed');
      expect(row?.lastError).toContain(`account_${accountState}`);
    },
  );

  it('reaches a device whose session is still open', async () => {
    const db = await setupDb();
    await enqueue(db, { channel: 'push' });
    await addPushToken(db, 'live-device');
    await linkDevice(db, 'live-device', 'ses_live', LIVE);
    const push = countingPush();

    await sweepNotifications(db, providers({ push: push.provider }), NOW);

    expect(push.sends.map((send) => send.token)).toEqual(['live-device']);
  });

  it('stops reaching a device once its session is signed out', async () => {
    const db = await setupDb();
    const rowId = await enqueue(db, { channel: 'push' });
    await addPushToken(db, 'revoked-device');
    await linkDevice(db, 'revoked-device', 'ses_revoked', EXPIRED);
    const push = countingPush();

    await sweepNotifications(db, providers({ push: push.provider }), NOW);

    expect(push.sends).toEqual([]);
    expect((await rowById(db, rowId))?.lastError).toContain('no_live_device');
  });

  it('keeps delivering to a device registered before sessions were associated', async () => {
    const db = await setupDb();
    await enqueue(db, { channel: 'push' });
    await addPushToken(db, 'legacy-device');
    const push = countingPush();

    await sweepNotifications(db, providers({ push: push.provider }), NOW);

    expect(push.sends.map((send) => send.token)).toEqual(['legacy-device']);
  });

  it('sends only to the live device when one of two is signed out', async () => {
    const db = await setupDb();
    await enqueue(db, { channel: 'push' });
    await addPushToken(db, 'kept');
    await addPushToken(db, 'gone');
    await linkDevice(db, 'kept', 'ses_kept', LIVE);
    await linkDevice(db, 'gone', 'ses_gone', EXPIRED);
    const push = countingPush();

    await sweepNotifications(db, providers({ push: push.provider }), NOW);

    expect(push.sends.map((send) => send.token)).toEqual(['kept']);
  });
});

describe('PF-07a — fallback eligibility after a primary failure', () => {
  it('still falls back to email when only the phone is gone', async () => {
    const db = await setupDb();
    const rowId = await enqueue(db, { fallbackChannel: 'email' });
    await withMember(db, { phoneNumber: null, phoneNumberVerified: false });

    await sweepNotifications(db, providers(), NOW);

    const fallback = (await allRows(db)).find(
      (row) => row.fallbackOf === rowId,
    );
    expect(fallback?.channel).toBe('email');
    expect(fallback?.status).toBe('pending');
  });

  it('writes no fallback when the account itself can no longer be reached', async () => {
    const db = await setupDb();
    const rowId = await enqueue(db, { fallbackChannel: 'email' });
    await withMember(db, { accountState: 'closing' });

    await sweepNotifications(db, providers(), NOW);

    expect((await allRows(db)).some((row) => row.fallbackOf === rowId)).toBe(
      false,
    );
  });

  it('re-checks the fallback when it is dispatched, not only when it is written', async () => {
    const db = await setupDb();
    const rowId = await enqueue(db, { fallbackChannel: 'email' });
    await withMember(db, { phoneNumber: null, phoneNumberVerified: false });
    await sweepNotifications(db, providers(), NOW);

    await withMember(db, { accountState: 'deleted' });
    await sweepNotifications(db, providers(), NOW);

    const fallback = (await allRows(db)).find(
      (row) => row.fallbackOf === rowId,
    );
    expect(fallback?.status).toBe('failed');
    expect(fallback?.lastError).toContain('account_deleted');
  });
});

describe('PF-07a — the sweep reports what the guard refused', () => {
  it('counts every refusal, not only the ones that also stop a fallback', async () => {
    const db = await setupDb();
    await enqueue(db);
    await withMember(db, { phoneNumber: null, phoneNumberVerified: false });

    const report = await sweepNotifications(db, providers(), NOW);

    expect(report.unreachable).toBe(1);
    expect(report.failed).toBe(1);
  });

  it('leaves the resolution invariant intact when rows are refused', async () => {
    const db = await setupDb();
    await enqueue(db);
    await enqueue(db, { channel: 'email' });
    await withMember(db, { accountState: 'closing' });

    const report = await sweepNotifications(db, providers(), NOW);

    expect(report.unreachable).toBe(2);
    expect(
      report.sent + report.retrying + report.failed + report.contended,
    ).toBe(report.selected + report.reclaimed);
  });
});

describe('PF-07a — the guard cannot be skipped', () => {
  it('applies to every channel a deployment can dispatch on', async () => {
    const db = await createDb(env.DB);
    expect(db).toBeTruthy();

    for (const channel of ['sms', 'email', 'push'] as const) {
      const scoped = await setupDb();
      const rowId = await enqueue(scoped, { channel });
      await withMember(scoped, { accountState: 'closing' });

      await sweepNotifications(
        scoped,
        providers({ push: countingPush().provider }),
        NOW,
      );

      const row = await rowById(scoped, rowId);
      expect(row?.status, channel).toBe('failed');
      expect(row?.lastError, channel).toContain('unreachable: account_closing');
    }
  });
});
