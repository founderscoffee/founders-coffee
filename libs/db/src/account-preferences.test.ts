import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  getAccountPreferences,
  updateAccountPreferences,
} from './account-preferences.js';
import { preferenceChanges, profileFixture } from './profiles.fixtures.js';
import { user } from './schema.js';

describe('account preferences on real D1', () => {
  it('starts with notification defaults and without channel consent', async () => {
    const { db, userId } = await profileFixture({ localePref: 'fr' });
    expect(await getAccountPreferences(db, userId)).toMatchObject({
      preferences: {
        eventUpdates: true,
        eventUpdatesChannels: 5,
        eventReminders: true,
        eventRemindersChannels: 5,
        hostRsvpReceived: true,
        hostRsvpReceivedChannels: 5,
        hostRsvpCancelled: true,
        hostRsvpCancelledChannels: 5,
        followUpPrompts: false,
        followUpPromptsChannels: 0,
        pushEnabled: false,
        smsFallbackEnabled: false,
        smsConsentAt: null,
        revision: 0,
      },
    });
    expect(await getAccountPreferences(db, 'missing')).toBeNull();
  });

  it('guards notification preferences with an optimistic revision', async () => {
    const { db, userId } = await profileFixture();
    expect(
      await updateAccountPreferences(db, {
        userId,
        expectedRevision: 0,
        changes: { ...preferenceChanges, pushEnabled: true },
      }),
    ).toMatchObject({ revision: 1, pushEnabled: true });
    expect(
      await updateAccountPreferences(db, {
        userId,
        expectedRevision: 0,
        changes: preferenceChanges,
      }),
    ).toBeNull();
    expect(await getAccountPreferences(db, userId)).toMatchObject({
      preferences: { pushEnabled: true },
    });
  });

  it('prevents lost concurrent preference edits', async () => {
    const { db, userId } = await profileFixture();
    const results = await Promise.all(
      ([true, false] as const).map((followUpPrompts) =>
        updateAccountPreferences(db, {
          userId,
          expectedRevision: 0,
          changes: {
            ...preferenceChanges,
            followUpPrompts,
            followUpPromptsChannels: followUpPrompts ? 5 : 0,
          },
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const saved = await getAccountPreferences(db, userId);
    expect([true, false]).toContain(saved?.preferences.followUpPrompts);
  });

  it('stores channel masks and derives category gates from whether any channel remains', async () => {
    const { db, userId } = await profileFixture();
    const saved = await updateAccountPreferences(db, {
      userId,
      expectedRevision: 0,
      changes: {
        ...preferenceChanges,
        eventUpdates: false,
        eventUpdatesChannels: 4,
        eventRemindersChannels: 0,
      },
    });

    expect(saved).toMatchObject({
      eventUpdates: true,
      eventUpdatesChannels: 4,
      eventReminders: false,
      eventRemindersChannels: 0,
      revision: 1,
    });
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
          changes: { ...preferenceChanges, smsFallbackEnabled: true },
        }),
      ).toBeNull();
      expect(await getAccountPreferences(db, userId)).toMatchObject({
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
      changes,
    });
    expect(enabled?.smsConsentAt).toBeInstanceOf(Date);
    expect(enabled?.smsConsentAt?.getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(
      (
        await updateAccountPreferences(db, {
          userId,
          expectedRevision: 1,
          changes,
        })
      )?.smsConsentAt,
    ).toEqual(enabled?.smsConsentAt);
    expect(
      await updateAccountPreferences(db, {
        userId,
        expectedRevision: 2,
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
          changes: preferenceChanges,
        }),
      ).toBeNull();
    },
  );
});
