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
  emptyProfileRequestSchema,
  emailChangeRequestSchema,
  phoneCodeRequestSchema,
  phoneConfirmRequestSchema,
} from './schemas.js';

/**
 * Hand Better Auth the caller's own session cookie and nothing else.
 *
 * The adapter builds its own request to the auth handler, so the cookie that identifies this caller
 * has to travel explicitly. Reading it here rather than inside the adapter keeps the adapter
 * testable without a request context.
 */
const authForwardHeaders = (): Headers => {
  const forwarded = new Headers();
  const cookie = getRequest().headers.get('cookie');
  if (cookie) forwarded.set('cookie', cookie);
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
  .validator(appValidator(emptyProfileRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    const session = requireAuth(context.session);
    return handleResult(
      sendCurrentEmailCode(
        session.user.id,
        session.user.email,
        authForwardHeaders(),
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
        authForwardHeaders(),
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
        authForwardHeaders(),
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
        authForwardHeaders(),
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
        authForwardHeaders(),
      ),
    );
  });
