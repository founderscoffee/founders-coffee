import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  getAccountPreferences,
  updateAccountPreferences,
} from './account-preferences.js';
import { preferenceChanges, profileFixture } from './profiles.fixtures.js';
import { user } from './schema.js';

describe('account preferences on real D1', () => {
  it('preserves existing locale and starts without channel consent', async () => {
    const { db, userId } = await profileFixture({ localePref: 'fr' });
    expect(await getAccountPreferences(db, userId)).toMatchObject({
      locale: 'fr',
      preferences: {
        eventUpdates: true,
        eventReminders: true,
        hostUpdates: true,
        followUpPrompts: false,
        pushEnabled: false,
        smsFallbackEnabled: false,
        smsConsentAt: null,
        revision: 0,
      },
    });
    expect(await getAccountPreferences(db, 'missing')).toBeNull();
  });

  it('guards locale and preferences with the same optimistic revision', async () => {
    const { db, userId } = await profileFixture();
    expect(
      await updateAccountPreferences(db, {
        userId,
        expectedRevision: 0,
        locale: 'ar',
        changes: { ...preferenceChanges, pushEnabled: true },
      }),
    ).toMatchObject({ revision: 1, pushEnabled: true });
    expect(
      await updateAccountPreferences(db, {
        userId,
        expectedRevision: 0,
        locale: 'fr',
        changes: preferenceChanges,
      }),
    ).toBeNull();
    expect(await getAccountPreferences(db, userId)).toMatchObject({
      locale: 'ar',
      preferences: { pushEnabled: true },
    });
  });

  it('prevents lost concurrent preference edits', async () => {
    const { db, userId } = await profileFixture();
    const results = await Promise.all(
      (['ar', 'fr'] as const).map((locale) =>
        updateAccountPreferences(db, {
          userId,
          expectedRevision: 0,
          locale,
          changes: { ...preferenceChanges, followUpPrompts: locale === 'fr' },
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const saved = await getAccountPreferences(db, userId);
    expect(saved?.preferences.followUpPrompts).toBe(saved?.locale === 'fr');
  });

  it.each([
    { phoneNumber: null, phoneNumberVerified: true },
    { phoneNumber: '', phoneNumberVerified: true },
    { phoneNumber: '+213555000001', phoneNumberVerified: false },
  ])(
    'does not enable SMS without a verified destination: %j',
    async (phone) => {
      const { db, userId } = await profileFixture(phone);
      expect(
        await updateAccountPreferences(db, {
          userId,
          expectedRevision: 0,
          locale: 'en',
          changes: { ...preferenceChanges, smsFallbackEnabled: true },
        }),
      ).toBeNull();
      expect(await getAccountPreferences(db, userId)).toMatchObject({
        locale: null,
        preferences: { revision: 0, smsConsentAt: null },
      });
    },
  );

  it('records server-owned consent once and clears it on withdrawal', async () => {
    const { db, userId } = await profileFixture({
      phoneNumber: '+213555000002',
      phoneNumberVerified: true,
    });
    const changes = {
      ...preferenceChanges,
      smsFallbackEnabled: true,
      smsConsentAt: new Date(0),
    };
    const enabled = await updateAccountPreferences(db, {
      userId,
      expectedRevision: 0,
      locale: 'en',
      changes,
    });
    expect(enabled?.smsConsentAt).toBeInstanceOf(Date);
    expect(enabled?.smsConsentAt?.getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(
      (
        await updateAccountPreferences(db, {
          userId,
          expectedRevision: 1,
          locale: null,
          changes,
        })
      )?.smsConsentAt,
    ).toEqual(enabled?.smsConsentAt);
    expect(
      await updateAccountPreferences(db, {
        userId,
        expectedRevision: 2,
        locale: null,
        changes: preferenceChanges,
      }),
    ).toMatchObject({
      smsConsentAt: null,
      smsFallbackEnabled: false,
      revision: 3,
    });
  });

  it.each([{ banned: true }, { accountState: 'closing' }])(
    'blocks restricted accounts: %j',
    async (restriction) => {
      const { db, userId } = await profileFixture();
      await db.update(user).set(restriction).where(eq(user.id, userId));
      expect(await getAccountPreferences(db, userId)).toBeNull();
      expect(
        await updateAccountPreferences(db, {
          userId,
          expectedRevision: 0,
          locale: 'fr',
          changes: preferenceChanges,
        }),
      ).toBeNull();
    },
  );
});
