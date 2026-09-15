import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  accountPreferences,
  createDb,
  eq,
  getNotificationContact,
  registerPushToken,
  seed,
  user,
  type Db,
} from '@founders-coffee/db';

import { readMyPreferences, saveMyPreferences } from './preferences.js';

const DEFAULTS = {
  eventUpdates: true,
  eventUpdatesChannels: ['push', 'email'] as ('push' | 'email')[],
  eventReminders: true,
  eventRemindersChannels: ['push', 'email'] as ('push' | 'email')[],
  hostUpdates: true,
  hostUpdatesChannels: ['push', 'email'] as ('push' | 'email')[],
  followUpPrompts: false,
  followUpPromptsChannels: [] as ('push' | 'email')[],
  smsFallbackEnabled: false,
};

const setup = async (overrides: Record<string, unknown> = {}) => {
  const db = createDb(env.DB);
  await seed(db);
  const userId = id('usr');
  await db.insert(user).values({
    id: userId,
    name: 'Preferences Owner',
    email: `${userId}@test.coffee`,
    emailVerified: true,
    ...overrides,
  });
  return { db, userId };
};

const withVerifiedPhone = () =>
  setup({
    phoneNumber: `+2136${String(Date.now()).slice(-8)}`,
    phoneNumberVerified: true,
  });

const save = (
  db: Db,
  userId: string,
  changes: Partial<typeof DEFAULTS> & {
    locale?: 'ar' | 'fr' | 'en' | null;
    expectedRevision: number;
  },
) => {
  const { locale = null, expectedRevision, ...rest } = changes;
  return saveMyPreferences(db, userId, {
    ...DEFAULTS,
    ...rest,
    locale,
    expectedRevision,
  });
};

describe('readMyPreferences', () => {
  it('answers with the declared defaults for a member who has never saved', async () => {
    const { db, userId } = await setup();

    const result = await readMyPreferences(db, userId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preferences).toEqual({
        ...DEFAULTS,
        pushEnabled: false,
      });
      expect(result.data.revision).toBe(0);
      expect(result.data.locale).toBeNull();
    }
  });

  it('creates the row a member has never had, so the screen can be saved', async () => {
    const { db, userId } = await setup();

    await readMyPreferences(db, userId);

    const rows = await db
      .select()
      .from(accountPreferences)
      .where(eq(accountPreferences.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it('says the SMS fallback is unavailable without a verified number', async () => {
    const { db, userId } = await setup();

    const result = await readMyPreferences(db, userId);

    expect(result.ok && result.data.smsAvailable).toBe(false);
  });

  it('says it is available once a number is verified', async () => {
    const { db, userId } = await withVerifiedPhone();

    const result = await readMyPreferences(db, userId);

    expect(result.ok && result.data.smsAvailable).toBe(true);
  });

  it('reports a missing identity as not found rather than as an empty account', async () => {
    const db = createDb(env.DB);

    const result = await readMyPreferences(db, 'usr_does_not_exist');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_found');
  });
});

describe('saveMyPreferences', () => {
  it('returns the saved policy with the revision the store assigned', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);

    const result = await save(db, userId, {
      eventReminders: false,
      expectedRevision: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preferences.eventReminders).toBe(false);
      expect(result.data.revision).toBe(1);
    }
  });

  it('rejects a second save at a revision another session already spent', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);
    await save(db, userId, { hostUpdates: false, expectedRevision: 0 });

    const stale = await save(db, userId, {
      followUpPrompts: true,
      expectedRevision: 0,
    });

    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('preferences_conflict');
  });

  it('refuses SMS consent without a verified number, and saves nothing', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);

    const result = await save(db, userId, {
      eventReminders: false,
      smsFallbackEnabled: true,
      expectedRevision: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('sms_consent_unavailable');
    const after = await readMyPreferences(db, userId);
    expect(after.ok && after.data.preferences.eventReminders).toBe(true);
    expect(after.ok && after.data.revision).toBe(0);
  });

  it('records consent time when the number is verified', async () => {
    const { db, userId } = await withVerifiedPhone();
    await readMyPreferences(db, userId);

    const result = await save(db, userId, {
      smsFallbackEnabled: true,
      expectedRevision: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preferences.smsFallbackEnabled).toBe(true);
      expect(result.data.smsConsentAt).toEqual(expect.any(String));
    }
  });

  it('clears the consent evidence when the member withdraws it', async () => {
    const { db, userId } = await withVerifiedPhone();
    await readMyPreferences(db, userId);
    await save(db, userId, { smsFallbackEnabled: true, expectedRevision: 0 });

    const withdrawn = await save(db, userId, {
      smsFallbackEnabled: false,
      expectedRevision: 1,
    });

    expect(withdrawn.ok).toBe(true);
    if (withdrawn.ok) expect(withdrawn.data.smsConsentAt).toBeNull();
  });

  it('persists the interface locale on the identity, which is its only home', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);

    await save(db, userId, { locale: 'fr', expectedRevision: 0 });

    const rows = await db
      .select({ locale: user.localePref })
      .from(user)
      .where(eq(user.id, userId));
    expect(rows[0]?.locale).toBe('fr');
  });

  it('clears the stored locale back to cookie resolution when set to null', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);
    await save(db, userId, { locale: 'ar', expectedRevision: 0 });

    const cleared = await save(db, userId, {
      locale: null,
      expectedRevision: 1,
    });

    expect(cleared.ok && cleared.data.locale).toBeNull();
  });
});

describe('push belongs to the server to record, not to the form to send', () => {
  const registerDevice = (db: Db, userId: string) =>
    registerPushToken(db, {
      id: id('pst'),
      userId,
      token: `tok_${userId}`,
      platform: 'web',
      surface: 'pwa',
      marketCode: 'DZ',
    });

  it('keeps a device registration that happened after the form loaded', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);
    await registerDevice(db, userId);

    const saved = await save(db, userId, {
      eventReminders: false,
      expectedRevision: 0,
    });

    expect(saved.ok && saved.data.preferences.pushEnabled).toBe(true);
    expect((await getNotificationContact(db, userId))?.pushEnabled).toBe(true);
  });

  it('does not invent a registration for a member who has no device', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);

    const saved = await save(db, userId, { locale: 'en', expectedRevision: 0 });

    expect(saved.ok && saved.data.preferences.pushEnabled).toBe(false);
  });
});

describe('what the member saves is what delivery reads', () => {
  it('turns off a category the dispatcher was about to honour', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);
    expect((await getNotificationContact(db, userId))?.eventReminders).toBe(
      true,
    );

    await save(db, userId, { eventReminders: false, expectedRevision: 0 });

    expect((await getNotificationContact(db, userId))?.eventReminders).toBe(
      false,
    );
  });

  it('opens the SMS fallback the dispatcher was refusing', async () => {
    const { db, userId } = await withVerifiedPhone();
    await readMyPreferences(db, userId);
    expect((await getNotificationContact(db, userId))?.smsFallbackEnabled).toBe(
      false,
    );

    await save(db, userId, { smsFallbackEnabled: true, expectedRevision: 0 });

    expect((await getNotificationContact(db, userId))?.smsFallbackEnabled).toBe(
      true,
    );
  });
});
