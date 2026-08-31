/**
 * Email provider interface — the only way email-OTP codes leave the system
 * (AGENTS.md §11.7: external services behind a provider interface). The real
 * provider (Cloudflare Email / React Email) lands with `libs/email` (P1);
 * `DevEmailProvider` is wired for dev + tests.
 */

export type OtpType =
  'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

export interface SendOtpArgs {
  email: string;
  otp: string;
  type: OtpType;
}

export interface EmailProvider {
  sendOtp(args: SendOtpArgs): void | Promise<void>;
}

/**
 * Dev email provider: records every sent code (observable in tests) and logs it
 * to the console so local devs can read the OTP to sign in. Dev-only by design —
 * production swaps in a real `EmailProvider`.
 */
export class DevEmailProvider implements EmailProvider {
  readonly sent: SendOtpArgs[] = [];

  sendOtp = (args: SendOtpArgs): void => {
    this.sent.push(args);
    console.log(
      `[DevEmailProvider] email-OTP for ${args.email} (${args.type}): ${args.otp}`,
    );
  };
}
