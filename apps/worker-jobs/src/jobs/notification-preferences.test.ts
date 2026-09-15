import { beforeEach, describe, expect, it } from 'vitest';

import { sql } from 'drizzle-orm';

import { accountPreferences, eq, type Db } from '@founders-coffee/db';

import { resolveDestination } from './notification-destination.js';
import { sweepNotifications } from './notification-sweep.js';
import {
  MEMBER_ID,
  addPushToken,
  allRows,
  countingSms,
  enqueue,
  fakePush,
  providers,
  rowById,
  setPreferences,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');

describe('a member with no preferences row is treated as the defaults', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await db
      .delete(accountPreferences)
      .where(eq(accountPreferences.userId, MEMBER_ID))
      .run();
  });

  it('has the two categories on, because that is what the column declares', async () => {
    const result = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'reminder_24h',
    );

    expect(result.ok).toBe(true);
  });

  it('has neither channel enabled, because that is what those columns declare', async () => {
    await addPushToken(db, 'device-1');

    const push = await resolveDestination(db, 'push', MEMBER_ID);
    const sms = await resolveDestination(db, 'sms', MEMBER_ID);

    expect(push.ok).toBe(false);
    if (!push.ok) expect(push.reason).toBe('push_not_enabled');
    expect(sms.ok).toBe(false);
    if (!sms.ok) expect(sms.reason).toBe('sms_not_consented');
  });
});

describe('categories are enforced at send time, not at enqueue time', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('drops a reminder for a member who turned reminders off after it was queued', async () => {
    const rowId = await enqueue(db, {
      channel: 'sms',
      templateKey: 'reminder_24h',
    });
    const sms = countingSms();
    await setPreferences(db, { eventReminders: false });

    await sweepNotifications(db, providers({ sms: sms.provider }), NOW);

    expect(sms.sends).toHaveLength(0);
    expect((await rowById(db, rowId))?.status).toBe('failed');
  });

  it('still sends the confirmation, which is a receipt rather than an update', async () => {
    await enqueue(db, { channel: 'sms', templateKey: 'rsvp_confirmation' });
    const sms = countingSms();
    await setPreferences(db, { eventReminders: false, eventUpdates: false });

    await sweepNotifications(db, providers({ sms: sms.provider }), NOW);

    expect(sms.sends).toHaveLength(1);
  });

  it('writes no fallback for a category refusal, since no channel would be allowed', async () => {
    const rowId = await enqueue(db, {
      channel: 'push',
      templateKey: 'reminder_72h',
      fallbackChannel: 'sms',
    });
    await addPushToken(db, 'device-1');
    await setPreferences(db, { eventReminders: false });

    await sweepNotifications(db, providers({ push: fakePush('ok') }), NOW);

    expect((await allRows(db)).filter((r) => r.fallbackOf !== null)).toEqual(
      [],
    );
    expect((await rowById(db, rowId))?.status).toBe('failed');
  });

  it('holds a closeout prompt while the market has operations switched off', async () => {
    await db.run(
      sql`UPDATE markets SET feature_flags = json_set(feature_flags, '$.communityOperations', json('false')) WHERE code = 'DZ'`,
    );
    const off = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'closeout_prompt',
      'DZ',
    );

    expect(off.ok).toBe(false);
    if (!off.ok) {
      expect(off.reason).toBe('operations_disabled');
      expect(off.account).toBe(true);
      expect(off.transient).toBe(true);
    }
  });

  it('marks every other refusal permanent, so only the flag is waited on', async () => {
    await setPreferences(db, { eventReminders: false });

    const off = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'reminder_24h',
      'DZ',
    );

    expect(off.ok).toBe(false);
    if (!off.ok) expect(off.transient).toBeUndefined();
  });

  it('does not hang a closeout prompt off the who-is-coming switch', async () => {
    await setPreferences(db, { hostUpdates: false });
    await db.run(
      sql`UPDATE markets SET feature_flags = json_set(coalesce(feature_flags, '{}'), '$.communityOperations', json('true')) WHERE code = 'DZ'`,
    );

    const result = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'closeout_prompt',
      'DZ',
    );

    expect(result.ok).toBe(true);
  });

  it('refuses a host notice when host updates are off, and not otherwise', async () => {
    const on = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'rsvp_received',
    );
    await setPreferences(db, { hostUpdates: false });
    const off = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'rsvp_received',
    );

    expect(on.ok).toBe(true);
    expect(off.ok).toBe(false);
    if (!off.ok) {
      expect(off.reason).toBe('host_updates_off');
      expect(off.account).toBe(true);
    }
  });

  it('leaves the other categories alone when host updates are off', async () => {
    await setPreferences(db, { hostUpdates: false });

    const reminder = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'reminder_24h',
    );
    const cancellation = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'event_cancelled',
    );

    expect(reminder.ok).toBe(true);
    expect(cancellation.ok).toBe(true);
  });

  it('refuses a cancellation notice only when event updates are off', async () => {
    const on = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'event_cancelled',
    );
    await setPreferences(db, { eventUpdates: false });
    const off = await resolveDestination(
      db,
      'email',
      MEMBER_ID,
      'event_cancelled',
    );

    expect(on.ok).toBe(true);
    expect(off.ok).toBe(false);
    if (!off.ok) {
      expect(off.reason).toBe('event_updates_off');
      expect(off.account).toBe(true);
    }
  });
});

describe('channels are enforced separately from categories', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('refuses SMS to a verified number the member never consented to use', async () => {
    await setPreferences(db, { smsFallbackEnabled: false });

    const result = await resolveDestination(db, 'sms', MEMBER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('sms_not_consented');
      expect(result.account).toBe(false);
    }
  });

  it('refuses push to a live device once the member switches push off', async () => {
    await addPushToken(db, 'device-1');
    await setPreferences(db, { pushEnabled: false });

    const result = await resolveDestination(db, 'push', MEMBER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('push_not_enabled');
  });

  it('still allows the other channel, so a channel refusal keeps its fallback', async () => {
    const rowId = await enqueue(db, {
      channel: 'push',
      fallbackChannel: 'sms',
    });
    await addPushToken(db, 'device-1');
    await setPreferences(db, { pushEnabled: false });
    const sms = countingSms();
    const deps = providers({ sms: sms.provider, push: fakePush('ok') });

    await sweepNotifications(db, deps, NOW);
    await sweepNotifications(db, deps, new Date(NOW.getTime() + 60_000));

    const fallback = (await allRows(db)).find((r) => r.fallbackOf === rowId);
    expect(fallback?.channel).toBe('sms');
    expect(sms.sends).toHaveLength(1);
  });
});
