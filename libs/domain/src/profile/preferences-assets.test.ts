import { describe, expect, it } from 'vitest';

import {
  profileAssetSchema,
  profilePhotoMetadataSchema,
  PROFILE_PHOTO_MAX_BYTES,
} from './assets.js';
import {
  accountStateSchema,
  notificationPreferencesSchema,
  updateAccountPreferencesSchema,
} from './preferences.js';

describe('account preferences', () => {
  it('defaults channels and optional follow-up prompts off', () => {
    for (const state of ['active', 'closing', 'deleted']) {
      expect(accountStateSchema.parse(state)).toBe(state);
    }
    expect(accountStateSchema.safeParse('suspended').success).toBe(false);
    expect(notificationPreferencesSchema.parse({})).toEqual({
      eventUpdates: true,
      eventReminders: true,
      hostUpdates: true,
      followUpPrompts: false,
      pushEnabled: false,
      smsFallbackEnabled: false,
    });
  });

  it('permits only supported locale preferences or the existing fallback chain', () => {
    for (const locale of ['ar', 'fr', 'en', null]) {
      expect(
        updateAccountPreferencesSchema.parse({ locale, expectedRevision: 0 })
          .locale,
      ).toBe(locale);
    }
    expect(
      updateAccountPreferencesSchema.safeParse({
        locale: 'es',
        expectedRevision: 0,
      }).success,
    ).toBe(false);
    expect(
      updateAccountPreferencesSchema.safeParse({
        locale: 'en',
        expectedRevision: 0,
        smsConsentAt: new Date(),
      }).success,
    ).toBe(false);
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
