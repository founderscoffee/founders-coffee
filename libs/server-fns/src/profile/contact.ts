import { AppError, err, ok, type Result } from '@founders-coffee/core';
import { createAuthHandler, type AuthDeps } from '@founders-coffee/auth';
import { logger } from '@founders-coffee/observability';

import { getAuthEnv } from '../auth.js';
import { preflightContactFailure } from './contact-preflight.js';

export interface ContactChangeAccepted {
  readonly accepted: true;
}

const ACCEPTED: ContactChangeAccepted = { accepted: true };

const CODE_BY_MESSAGE: ReadonlyArray<readonly [RegExp, string]> = [
  [/already in use|phone number is already/i, 'contact_taken'],
  [/same/i, 'contact_unchanged'],
  [/invalid.*otp|otp.*invalid|incorrect/i, 'contact_code_invalid'],
  [/expired/i, 'contact_code_expired'],
  [/too many|rate/i, 'rate_limited'],
  [/required/i, 'contact_code_required'],
];

/**
 * Translate a Better Auth refusal into a code this product owns, carrying nothing it said.
 *
 * The upstream messages are English strings meant for a developer, and some of them name the state
 * of another account — "Email already in use" is true of somebody, and that somebody is not the
 * caller. Mapping to a fixed set means the client can say something useful in three languages while
 * the response says nothing that was not already true for the person reading it.
 */
const refusal = (message: string): AppError => {
  const match = CODE_BY_MESSAGE.find(([pattern]) => pattern.test(message));
  return new AppError(
    match ? match[1] : 'contact_change_failed',
    'That change could not be completed',
  );
};

/**
 * Run one Better Auth contact endpoint and answer with an outcome, never with its response.
 *
 * Every endpoint here returns more than the caller needs: `/phone-number/verify` answers with the
 * session token and the whole user row. Projecting to `{ accepted: true }` is not tidiness — it is
 * the only thing standing between a session token and a JSON response, and a change of contact
 * either happened or it did not, so there is nothing else worth returning.
 *
 * Going through the handler keeps the composed Better Auth pipeline intact. Expected invalid-code
 * and duplicate-contact outcomes are
 * preflighted in the repository adapter because Better Auth's router leaks its APIError promise in
 * the Workers test pool even after it has produced the corresponding HTTP response.
 *
 * The preflight only short-circuits a known refusal; successful requests still go through the
 * handler, which remains the source of truth for session and account mutation.
 *
 * These operations run only after the surrounding server functions have authenticated the member
 * and checked the profile-update permission, so they use the internal authenticated handler mode
 * without a browser challenge. Public auth requests continue through the normal captcha-gated
 * handler.
 */
const contactOperation = async (
  operation: string,
  userId: string,
  path: string,
  body: Record<string, unknown>,
  headers: Headers,
  deps: AuthDeps = {},
): Promise<Result<ContactChangeAccepted>> => {
  logger.info('contact_change_requested', { operation, userId });
  const env = getAuthEnv();
  const request = new Request(`${env.APP_URL}/api/auth${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: env.APP_URL,
      cookie: headers.get('cookie') ?? '',
    },
    body: JSON.stringify(body),
  });

  try {
    const preflightFailure = await preflightContactFailure(
      env,
      userId,
      path,
      body,
    );
    if (preflightFailure) {
      logger.warn('contact_change_rejected', {
        operation,
        userId,
        code: preflightFailure.code,
      });
      return err(
        new AppError(
          preflightFailure.code,
          'That change could not be completed',
        ),
      );
    }

    const response = await createAuthHandler(env, {
      ...deps,
      captchaBypassed: true,
    })(request);
    if (response.ok) return ok(ACCEPTED);
    const answer = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const failure = refusal(String(answer?.message ?? ''));
    logger.warn('contact_change_rejected', {
      operation,
      userId,
      code: failure.code,
    });
    return err(failure);
  } catch {
    logger.error('contact_change_failed', { operation, userId });
    return err(
      new AppError(
        'contact_change_failed',
        'That change could not be completed',
      ),
    );
  }
};

/** Send the code that proves the caller still holds the address on file. */
export const sendCurrentEmailCode = (
  userId: string,
  email: string,
  headers: Headers,
  deps?: AuthDeps,
): Promise<Result<ContactChangeAccepted>> =>
  contactOperation(
    'email_current_code',
    userId,
    '/email-otp/send-verification-otp',
    { email, type: 'email-verification' },
    headers,
    deps,
  );

/** Ask for a change, proving the current address; the code then goes to the new one. */
export const requestEmailChange = (
  userId: string,
  input: { newEmail: string; otp: string },
  headers: Headers,
  deps?: AuthDeps,
): Promise<Result<ContactChangeAccepted>> =>
  contactOperation(
    'email_change_requested',
    userId,
    '/email-otp/request-email-change',
    { newEmail: input.newEmail, otp: input.otp },
    headers,
    deps,
  );

/** Complete the change with the code sent to the new address. */
export const confirmEmailChange = (
  userId: string,
  input: { newEmail: string; otp: string },
  headers: Headers,
  deps?: AuthDeps,
): Promise<Result<ContactChangeAccepted>> =>
  contactOperation(
    'email_change_confirmed',
    userId,
    '/email-otp/change-email',
    { newEmail: input.newEmail, otp: input.otp },
    headers,
    deps,
  );

/**
 * Whether this deployment can actually put an SMS on a phone.
 *
 * The auth factory falls back to a development provider that prints the code to the console when
 * Twilio is absent, which is right for a laptop and silently wrong anywhere else: the endpoint
 * answers success and the member waits for a message nobody sent. Outside development the absence
 * of credentials is a misconfiguration, and the honest answer is a refusal.
 */
const smsIsDeliverable = (): boolean => {
  const env = getAuthEnv() as {
    TWILIO_SID?: string;
    TWILIO_AID?: string;
    TWILIO_SEC?: string;
    APP_ENVIRONMENT?: string;
  };
  if (env.TWILIO_SID && env.TWILIO_AID && env.TWILIO_SEC) return true;
  return (env.APP_ENVIRONMENT ?? 'development') === 'development';
};

/** Send a code to a number the member wants to add or move to. */
export const sendPhoneCode = (
  userId: string,
  phoneNumber: string,
  headers: Headers,
  deps?: AuthDeps,
): Promise<Result<ContactChangeAccepted>> => {
  if (!smsIsDeliverable()) {
    logger.error('contact_sms_unconfigured', { userId });
    return Promise.resolve(
      err(new AppError('sms_unavailable', 'Phone codes are unavailable')),
    );
  }
  return contactOperation(
    'phone_code',
    userId,
    '/phone-number/send-otp',
    { phoneNumber },
    headers,
    deps,
  );
};

/**
 * Attach the number once the code proves it.
 *
 * `updatePhoneNumber` is what keeps this off the columns directly: Better Auth refuses a number
 * that belongs to another account rather than moving it, so two members can never end up sharing
 * one, and the write happens inside the same call that verified the code.
 */
export const confirmPhoneNumber = (
  userId: string,
  input: { phoneNumber: string; otp: string },
  headers: Headers,
  deps?: AuthDeps,
): Promise<Result<ContactChangeAccepted>> =>
  contactOperation(
    'phone_confirmed',
    userId,
    '/phone-number/verify',
    {
      phoneNumber: input.phoneNumber,
      code: input.otp,
      updatePhoneNumber: true,
      disableSession: true,
    },
    headers,
    deps,
  );
