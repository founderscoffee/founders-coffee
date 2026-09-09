import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requirePermission } from '../auth-middleware.js';
import { requireAuth } from '../authz.js';
import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import { requireProfileTurnstile } from '../turnstile/middleware.js';
import { readAccountSummary } from './account.js';
import {
  confirmEmailChange,
  confirmPhoneNumber,
  requestEmailChange,
  sendCurrentEmailCode,
  sendPhoneCode,
} from './contact.js';
import { removeCurrentPhoto, reservePhotoUpload } from './photo.js';
import { photoServices } from './photo-runtime.js';
import {
  readOwnerProfile,
  readPublicProfile,
  saveDisplayName,
  saveOwnerProfile,
} from './resolver.js';
import {
  CONTACT_CHANGE_LIMIT,
  CONTACT_CODE_LIMIT,
  emailChangeRequestSchema,
  emptyProfileRequestSchema,
  phoneCodeRequestSchema,
  phoneConfirmRequestSchema,
  PHOTO_RESERVE_LIMIT,
  PROFILE_READ_LIMIT,
  PROFILE_UPDATE_LIMIT,
  publicProfileRequestSchema,
  reservePhotoRequestSchema,
  updateDisplayNameRequestSchema,
  updateProfileRequestSchema,
} from './schemas.js';

const profileWriteProtection = [
  requirePermission('profile', 'update'),
  rateLimit(
    PROFILE_UPDATE_LIMIT.action,
    PROFILE_UPDATE_LIMIT.limit,
    PROFILE_UPDATE_LIMIT.windowMs,
  ),
  requireProfileTurnstile,
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
    requireProfileTurnstile,
  ])
  .validator(appValidator(reservePhotoRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    return handleResult(
      reservePhotoUpload(getDb(), requireAuth(context.session).user.id),
    );
  });

export const removeMyPhoto = createServerFn({ method: 'POST', strict: false })
  .middleware(profileWriteProtection)
  .validator(appValidator(reservePhotoRequestSchema))
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

/**
 * Hand Better Auth the caller's own cookie and challenge, and nothing else.
 *
 * The adapters build their own request to the auth handler, so the two things that identify this
 * caller have to travel explicitly: the session cookie, and the Turnstile token the member solved
 * in the browser. Reading them here rather than inside the adapter keeps the adapter testable
 * without a request context.
 */
const authForwardHeaders = (turnstileToken?: string): Headers => {
  const forwarded = new Headers();
  const cookie = getRequest().headers.get('cookie');
  if (cookie) forwarded.set('cookie', cookie);
  if (turnstileToken) forwarded.set('x-captcha-response', turnstileToken);
  return forwarded;
};

const contactCodeProtection = [
  requirePermission('profile', 'update'),
  rateLimit(
    CONTACT_CODE_LIMIT.action,
    CONTACT_CODE_LIMIT.limit,
    CONTACT_CODE_LIMIT.windowMs,
  ),
] as const;

const contactChangeProtection = [
  requirePermission('profile', 'update'),
  rateLimit(
    CONTACT_CHANGE_LIMIT.action,
    CONTACT_CHANGE_LIMIT.limit,
    CONTACT_CHANGE_LIMIT.windowMs,
  ),
] as const;

export const sendMyEmailChangeCode = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(contactCodeProtection)
  .validator(appValidator(reservePhotoRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    const session = requireAuth(context.session);
    return handleResult(
      sendCurrentEmailCode(
        session.user.id,
        session.user.email,
        authForwardHeaders(data.turnstileToken),
      ),
    );
  });

export const requestMyEmailChange = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(contactChangeProtection)
  .validator(appValidator(emailChangeRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      requestEmailChange(
        requireAuth(context.session).user.id,
        { newEmail: data.newEmail, otp: data.otp },
        authForwardHeaders(data.turnstileToken),
      ),
    );
  });

export const confirmMyEmailChange = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(contactChangeProtection)
  .validator(appValidator(emailChangeRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      confirmEmailChange(
        requireAuth(context.session).user.id,
        { newEmail: data.newEmail, otp: data.otp },
        authForwardHeaders(data.turnstileToken),
      ),
    );
  });

export const sendMyPhoneCode = createServerFn({ method: 'POST', strict: false })
  .middleware(contactCodeProtection)
  .validator(appValidator(phoneCodeRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      sendPhoneCode(
        requireAuth(context.session).user.id,
        data.phoneNumber,
        authForwardHeaders(data.turnstileToken),
      ),
    );
  });

export const confirmMyPhoneNumber = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(contactChangeProtection)
  .validator(appValidator(phoneConfirmRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      confirmPhoneNumber(
        requireAuth(context.session).user.id,
        { phoneNumber: data.phoneNumber, otp: data.otp },
        authForwardHeaders(data.turnstileToken),
      ),
    );
  });
