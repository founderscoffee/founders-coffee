import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requirePermission } from '../auth-middleware.js';
import { requireAuth } from '../authz.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import {
  confirmEmailChange,
  confirmPhoneNumber,
  requestEmailChange,
  sendCurrentEmailCode,
  sendPhoneCode,
} from './contact.js';
import {
  CONTACT_CHANGE_LIMIT,
  CONTACT_CODE_LIMIT,
  emailChangeRequestSchema,
  phoneCodeRequestSchema,
  phoneConfirmRequestSchema,
  reservePhotoRequestSchema,
} from './schemas.js';

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
