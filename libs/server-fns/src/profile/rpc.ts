import { createServerFn } from '@tanstack/react-start';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requirePermission } from '../auth-middleware.js';
import { requireAuth } from '../authz.js';
import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import { readAccountSummary, saveAccountLocale } from './account.js';
import { readMyPreferences, saveMyPreferences } from './preferences.js';
import { removeCurrentPhoto, reservePhotoUpload } from './photo.js';
import { photoServices } from './photo-runtime.js';
import {
  readOwnerProfile,
  readPublicProfile,
  saveDisplayName,
  saveOwnerProfile,
} from './resolver.js';
import {
  emptyProfileRequestSchema,
  PHOTO_RESERVE_LIMIT,
  PROFILE_READ_LIMIT,
  PROFILE_UPDATE_LIMIT,
  publicProfileRequestSchema,
  updateDisplayNameRequestSchema,
  updateAccountLocaleRequestSchema,
  updatePreferencesRequestSchema,
  updateProfileRequestSchema,
} from './schemas.js';

const profileWriteProtection = [
  requirePermission('profile', 'update'),
  rateLimit(
    PROFILE_UPDATE_LIMIT.action,
    PROFILE_UPDATE_LIMIT.limit,
    PROFILE_UPDATE_LIMIT.windowMs,
  ),
] as const;

export const getMyProfile = createServerFn({ strict: false })
  .middleware([requirePermission('profile', 'read')])
  .validator(appValidator(emptyProfileRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    return handleResult(
      readOwnerProfile(getDb(), requireAuth(context.session).user.id),
    );
  });

export const getPublicProfile = createServerFn({ strict: false })
  .middleware([
    rateLimit(
      PROFILE_READ_LIMIT.action,
      PROFILE_READ_LIMIT.limit,
      PROFILE_READ_LIMIT.windowMs,
    ),
  ])
  .validator(appValidator(publicProfileRequestSchema))
  .handler(({ data }) => {
    privateNoStore();
    return handleResult(readPublicProfile(getDb(), data.userId));
  });

export const updateMyProfile = createServerFn({ method: 'POST', strict: false })
  .middleware(profileWriteProtection)
  .validator(appValidator(updateProfileRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      saveOwnerProfile(
        getDb(),
        requireAuth(context.session).user.id,
        data.profile,
      ),
    );
  });

export const getMyPreferences = createServerFn({ strict: false })
  .middleware([requirePermission('profile', 'read')])
  .validator(appValidator(emptyProfileRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    return handleResult(
      readMyPreferences(getDb(), requireAuth(context.session).user.id),
    );
  });

export const updateMyPreferences = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(profileWriteProtection)
  .validator(appValidator(updatePreferencesRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      saveMyPreferences(
        getDb(),
        requireAuth(context.session).user.id,
        data.preferences,
      ),
    );
  });

export const updateMyDisplayName = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(profileWriteProtection)
  .validator(appValidator(updateDisplayNameRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      saveDisplayName(getDb(), requireAuth(context.session).user.id, data),
    );
  });

/**
 * Whether this environment can accept a photo at all.
 *
 * The upload control is not rendered where the answer is no. An input that opens a file picker and
 * then fails on submit is worse than no input: it tells a member the product supports something it
 * does not, and the plan's rule is that no upload control ships before the real provider works.
 */
export const getPhotoUploadAvailability = createServerFn({
  strict: false,
}).handler(() => {
  privateNoStore();
  return { enabled: photoServices() !== null };
});

export const reserveMyPhotoUpload = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('profile', 'update'),
    rateLimit(
      PHOTO_RESERVE_LIMIT.action,
      PHOTO_RESERVE_LIMIT.limit,
      PHOTO_RESERVE_LIMIT.windowMs,
    ),
  ])
  .validator(appValidator(emptyProfileRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    return handleResult(
      reservePhotoUpload(getDb(), requireAuth(context.session).user.id),
    );
  });

export const removeMyPhoto = createServerFn({ method: 'POST', strict: false })
  .middleware(profileWriteProtection)
  .validator(appValidator(emptyProfileRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    return handleResult(
      removeCurrentPhoto(getDb(), requireAuth(context.session).user.id),
    );
  });

export const getMyAccount = createServerFn({ strict: false })
  .middleware([requirePermission('profile', 'read')])
  .validator(appValidator(emptyProfileRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    return handleResult(
      readAccountSummary(getDb(), requireAuth(context.session).user.id),
    );
  });

export const updateMyAccountLocale = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(profileWriteProtection)
  .validator(appValidator(updateAccountLocaleRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      saveAccountLocale(
        getDb(),
        requireAuth(context.session).user.id,
        data.account.locale,
      ),
    );
  });
