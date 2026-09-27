import type {
  EmailProvider,
  OtpRequestContext,
  OtpType,
} from '@founders-coffee/auth';
import {
  renderEmail,
  type EmailProvider as MailProvider,
} from '@founders-coffee/email';
import { OtpEmail } from '@founders-coffee/email/templates';
import {
  detectLocale,
  email_otp_code_label,
  email_otp_expiry,
  email_otp_greeting,
  email_otp_preview,
  email_otp_subject_change_email,
  email_otp_subject_email_verification,
  email_otp_subject_forget_password,
  email_otp_subject_sign_in,
  type Locale,
} from '@founders-coffee/i18n';
import { logger } from '@founders-coffee/observability';

import { shouldEchoSignInCode, type OtpEchoEnv } from './otp-echo';

const subjectFor = (type: OtpType, locale: Locale): string => {
  switch (type) {
    case 'sign-in':
      return email_otp_subject_sign_in({}, { locale });
    case 'email-verification':
      return email_otp_subject_email_verification({}, { locale });
    case 'forget-password':
      return email_otp_subject_forget_password({}, { locale });
    case 'change-email':
      return email_otp_subject_change_email({}, { locale });
  }
};

/**
 * Adapter: Better Auth's email-OTP plugin calls `sendOtp({email, otp, type})`; this renders a
 * OtpEmail with the code and sends it through the email provider supplied by the server. The two
 * EmailProvider interfaces differ (auth's `sendOtp` vs email's structured `send → Result`), so the
 * bridge lives here, in the app. On send failure we log + throw, but Better Auth does not surface it:
 * `runInBackgroundOrAwait` catches the rejection and still answers 200, so this log line is the only
 * signal a code never left the building — alert on it. Locale comes from the Better Auth request
 * cookie and falls back to Arabic when no supported locale is present.
 */
export const createOtpEmailProvider = (
  emailProvider: MailProvider,
  echoEnv: OtpEchoEnv = {},
): EmailProvider => ({
  sendOtp: async ({ email, otp, type }, context?: OtpRequestContext) => {
    const locale = detectLocale(context?.headers?.get('cookie') ?? null);
    if (shouldEchoSignInCode(echoEnv, email)) {
      logger.warn(`email-OTP for ${email} (${type}): ${otp}`, {
        recipient: email.split('@')[0],
      });
    }
    const { html, text } = await renderEmail(OtpEmail, {
      locale,
      preview: email_otp_preview({ code: otp }, { locale }),
      greeting: email_otp_greeting({}, { locale }),
      codeLabel: email_otp_code_label({}, { locale }),
      code: otp,
      expiry: email_otp_expiry({}, { locale }),
    });
    const result = await emailProvider.send({
      to: email,
      subject: subjectFor(type, locale),
      html,
      text,
    });
    if (!result.ok) {
      logger.error('otp_email_failed', { type, code: result.error.code });
      throw result.error;
    }
  },
});
