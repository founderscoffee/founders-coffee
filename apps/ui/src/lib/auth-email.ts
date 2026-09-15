import type { EmailProvider, OtpType } from '@founders-coffee/auth';
import {
  createCloudflareEmailProvider,
  renderEmail,
} from '@founders-coffee/email';
import { OtpEmail } from '@founders-coffee/email/templates';
import { logger } from '@founders-coffee/observability';

import { shouldEchoSignInCode, type OtpEchoEnv } from './otp-echo';

const OTP_SUBJECTS: Record<OtpType, string> = {
  'sign-in': 'founders.coffee - your sign-in code',
  'email-verification': 'founders.coffee - your verification code',
  'forget-password': 'founders.coffee - your password-reset code',
  'change-email': 'founders.coffee - your email-change code',
};

/**
 * Adapter: Better Auth's email-OTP plugin calls `sendOtp({email, otp, type})`; this renders a
 * NotificationEmail with the code + sends it via the real Cloudflare Email binding (D13). The two
 * EmailProvider interfaces differ (auth's `sendOtp` vs email's structured `send → Result`), so the
 * bridge lives here, in the app. On send failure we log + throw, but Better Auth does not surface it:
 * `runInBackgroundOrAwait` catches the rejection and still answers 200, so this log line is the only
 * signal a code never left the building — alert on it. Locale is the base `ar` (no session/market
 * context at signup).
 */
export const createOtpEmailProvider = (
  emailBinding: SendEmail,
  defaultFrom: string,
  echoEnv: OtpEchoEnv = {},
): EmailProvider => ({
  sendOtp: async ({ email, otp, type }) => {
    if (shouldEchoSignInCode(echoEnv, email)) {
      logger.warn(`email-OTP for ${email} (${type}): ${otp}`, {
        recipient: email.split('@')[0],
      });
    }
    const provider = createCloudflareEmailProvider(emailBinding, defaultFrom);
    const { html, text } = await renderEmail(OtpEmail, {
      locale: 'ar',
      preview: `رمز التحقق: ${otp}`,
      greeting: 'مرحبًا بك في founders.coffee',
      codeLabel: 'استخدم الرمز التالي للمتابعة.',
      code: otp,
      expiry: 'تنتهي صلاحيته خلال 5 دقائق.',
      footer: 'founders.coffee',
    });
    const result = await provider.send({
      to: email,
      subject: OTP_SUBJECTS[type],
      html,
      text,
    });
    if (!result.ok) {
      logger.error('otp_email_failed', { type, code: result.error.code });
      throw result.error;
    }
  },
});
