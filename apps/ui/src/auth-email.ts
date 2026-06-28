import type { EmailProvider, OtpType } from '@founders-coffee/auth';
import { createCloudflareEmailProvider, renderEmail } from '@founders-coffee/email';
import { NotificationEmail } from '@founders-coffee/email/templates';
import { logger } from '@founders-coffee/observability';

const OTP_SUBJECTS: Record<OtpType, string> = {
  'sign-in': 'founders.coffee — your sign-in code',
  'email-verification': 'founders.coffee — your verification code',
  'forget-password': 'founders.coffee — your password-reset code',
  'change-email': 'founders.coffee — your email-change code',
};

/**
 * Adapter: Better Auth's email-OTP plugin calls `sendOtp({email, otp, type})`; this renders a
 * NotificationEmail with the code + sends it via the real Cloudflare Email binding (D13). The two
 * EmailProvider interfaces differ (auth's `sendOtp` vs email's structured `send → Result`), so the
 * bridge lives here, in the app. On send failure we log + throw — Better Auth surfaces it (the
 * send-verification-otp endpoint already acknowledges the email, so no extra existence leak). Locale
 * is the base `ar` (no session/market context at signup).
 */
export const createOtpEmailProvider = (
  emailBinding: SendEmail,
  defaultFrom: string,
): EmailProvider => ({
  sendOtp: async ({ email, otp, type }) => {
    const provider = createCloudflareEmailProvider(emailBinding, defaultFrom);
    const { html, text } = await renderEmail(NotificationEmail, {
      locale: 'ar',
      preview: `رمز التحقق: ${otp}`,
      greeting: 'مرحبًا بك في founders.coffee',
      lines: ['استخدم الرمز التالي للمتابعة. تنتهي صلاحيته خلال 5 دقائق.', otp],
      footer: 'founders.coffee',
    });
    const result = await provider.send({
      to: email,
      subject: OTP_SUBJECTS[type],
      html,
      text,
    });
    if (!result.ok) {
      logger.warn('otp_email_failed', { type, code: result.error.code });
      throw result.error;
    }
  },
});
