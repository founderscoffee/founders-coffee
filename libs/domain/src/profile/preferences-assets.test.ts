import { describe, expect, it } from 'vitest';

import {
  profileAssetSchema,
  profilePhotoMetadataSchema,
  PROFILE_PHOTO_MAX_BYTES,
} from './assets.js';
import {
  accountStateSchema,
  channelsToMask,
  maskToChannels,
  notificationPreferencesSchema,
  updateAccountPreferencesSchema,
} from './preferences.js';
import {
  accountSummarySchema,
  updateAccountLocaleSchema,
} from './account-summary.js';

describe('account preferences', () => {
  it('defaults every category on, with follow-up prompts on email only', () => {
    for (const state of ['active', 'closing', 'deleted']) {
      expect(accountStateSchema.parse(state)).toBe(state);
    }
    expect(accountStateSchema.safeParse('suspended').success).toBe(false);
    expect(notificationPreferencesSchema.parse({})).toEqual({
      eventUpdates: true,
      eventUpdatesChannels: ['push', 'email'],
      eventReminders: true,
      eventRemindersChannels: ['push', 'email'],
      hostRsvpReceived: true,
      hostRsvpReceivedChannels: ['push', 'email'],
      hostRsvpCancelled: true,
      hostRsvpCancelledChannels: ['push', 'email'],
      followUpPrompts: true,
      followUpPromptsChannels: ['email'],
      pushEnabled: false,
      smsFallbackEnabled: false,
    });
  });

  it('accepts unique channel sets and converts their masks without losing order', () => {
    const parsed = notificationPreferencesSchema.parse({
      eventUpdatesChannels: ['email'],
      eventRemindersChannels: [],
    });

    expect(parsed.eventUpdatesChannels).toEqual(['email']);
    expect(channelsToMask(parsed.eventUpdatesChannels)).toBe(4);
    expect(channelsToMask(['push', 'email'])).toBe(5);
    expect(maskToChannels(5)).toEqual(['push', 'email']);
    expect(maskToChannels(0)).toEqual([]);
    expect(
      notificationPreferencesSchema.safeParse({
        eventUpdatesChannels: ['push', 'push'],
      }).success,
    ).toBe(false);
  });

  it('requires the optimistic revision and rejects unsupported fields', () => {
    expect(
      updateAccountPreferencesSchema.parse({ expectedRevision: 0 }),
    ).toEqual({
      eventUpdates: true,
      eventUpdatesChannels: ['push', 'email'],
      eventReminders: true,
      eventRemindersChannels: ['push', 'email'],
      hostRsvpReceived: true,
      hostRsvpReceivedChannels: ['push', 'email'],
      hostRsvpCancelled: true,
      hostRsvpCancelledChannels: ['push', 'email'],
      followUpPrompts: true,
      followUpPromptsChannels: ['email'],
      smsFallbackEnabled: false,
      expectedRevision: 0,
    });
    expect(
      updateAccountPreferencesSchema.safeParse({
        expectedRevision: 0,
        smsConsentAt: new Date(),
      }).success,
    ).toBe(false);
  });
});

describe('account language', () => {
  it('accepts only the supported interface locales', () => {
    expect(accountSummarySchema.shape.locale.parse('fr')).toBe('fr');
    expect(updateAccountLocaleSchema.parse({ locale: 'en' })).toEqual({
      locale: 'en',
    });
    expect(updateAccountLocaleSchema.safeParse({ locale: 'es' }).success).toBe(
      false,
    );
  });
});

describe('photo contracts', () => {
  const metadata = {
    mimeType: 'image/jpeg',
    byteSize: PROFILE_PHOTO_MAX_BYTES,
    width: 4000,
    height: 4000,
  };

  it('accepts bounded static raster formats', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(
        profilePhotoMetadataSchema.parse({ ...metadata, mimeType }).mimeType,
      ).toBe(mimeType);
    }
    expect(
      profileAssetSchema.parse({
        id: `pha_${'1'.repeat(32)}`,
        userId: 'auth-id',
        status: 'pending',
        metadata: null,
      }).status,
    ).toBe('pending');
    expect(
      profileAssetSchema.parse({
        id: `pha_${'1'.repeat(32)}`,
        userId: 'auth-id',
        status: 'ready',
        metadata,
      }).metadata,
    ).toEqual(metadata);
  });

  it('rejects unsupported formats, oversize payloads and dimension bombs', () => {
    for (const changes of [
      { mimeType: 'image/svg+xml' },
      { mimeType: 'image/gif' },
      { byteSize: 0 },
      { byteSize: PROFILE_PHOTO_MAX_BYTES + 1 },
      { width: 4001 },
      { height: 0 },
      { width: 1.5 },
    ]) {
      expect(
        profilePhotoMetadataSchema.safeParse({ ...metadata, ...changes })
          .success,
      ).toBe(false);
    }
    expect(
      profileAssetSchema.safeParse({
        id: `pha_${'1'.repeat(32)}`,
        userId: 'auth-id',
        status: 'ready',
        metadata,
        objectKey: 'chosen-by-client',
      }).success,
    ).toBe(false);
  });
});
