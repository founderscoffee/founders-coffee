import type { EmailProvider, OtpType } from '@founders-coffee/auth';
import {
  createCloudflareEmailProvider,
  renderEmail,
} from '@founders-coffee/email';
import { OtpEmail } from '@founders-coffee/email/templates';
import { logger } from '@founders-coffee/observability';

const OTP_SUBJECTS: Record<OtpType, string> = {
  'sign-in': 'Founders Coffee admin - your sign-in code',
  'email-verification': 'Founders Coffee admin - your verification code',
  'forget-password': 'Founders Coffee admin - your password-reset code',
  'change-email': 'Founders Coffee admin - your email-change code',
};

/**
 * The operator's sign-in code, mailed and never logged.
 *
 * Deliberately its own adapter rather than the public app's. `apps/ui` fences an OTP echo for the
 * release smoke — three conditions, a reserved test domain — and that fence is a thing the admin
 * origin should not have at all. A member's code in a log is a weakening; an operator's code in a
 * log is the operator. There is no flag here that could turn one on.
 *
 * Better Auth's email-OTP plugin calls `sendOtp({ email, otp, type })`; the email library speaks a
 * structured `send → Result`. The bridge lives in the app because the two interfaces belong to
 * different libraries and neither should learn the other's shape.
 *
 * A send failure is logged and rethrown, and Better Auth still answers 200 —
 * `runInBackgroundOrAwait` swallows the rejection. This log line is therefore the only signal that
 * a code never left the building, which is exactly what happened to every notification email until
 * the Message-ID bug was found. Alert on it.
 */
export const createAdminOtpEmailProvider = (
  emailBinding: SendEmail,
  defaultFrom: string,
): EmailProvider => ({
  sendOtp: async ({ email, otp, type }) => {
    const provider = createCloudflareEmailProvider(emailBinding, defaultFrom);
    const { html, text } = await renderEmail(OtpEmail, {
      locale: 'en',
      preview: 'Your Founders Coffee admin sign-in code',
      greeting: 'Founders Coffee operations',
      codeLabel: 'Use this code to continue.',
      code: otp,
      expiry: 'It expires in 30 minutes.',
      footer: 'Founders Coffee',
    });
    const result = await provider.send({
      to: email,
      subject: OTP_SUBJECTS[type],
      html,
      text,
    });
    if (!result.ok) {
      logger.error('admin_otp_email_failed', { type, code: result.error.code });
      throw result.error;
    }
  },
});
