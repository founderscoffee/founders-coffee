/**
 * SMS provider interface — the only way SMS OTP codes leave the system
 * (AGENTS.md §11.7: external services behind a provider interface). The real
 * provider (Twilio Verify) lands with `libs/auth`; `DevSmsProvider` is wired
 * for dev + tests.
 *
 * This interface is SHARED between auth OTP and notification SMS (Phase 5) —
 * one provider interface, not parallel ones (DRY).
 */

import { AppError } from '@founders-coffee/core';
import { logger } from '@founders-coffee/observability';

export interface SendSmsOtpArgs {
  phoneNumber: string;
  code: string;
}

export interface SmsProvider {
  /**
   * Send an OTP code via SMS. Returns `{ fraudGuardBlocked: true }` if Twilio
   * Fraud Guard (error 60410) blocked the number — caller should surface
   * "Try email instead." and skip retries for 12h.
   *
   * Throws `AppError('sms_failed')` on transient errors (carrier reject, network).
   * The caller is responsible for rate-limiting + Fraud Guard short-circuit caching.
   */
  sendOtp(args: SendSmsOtpArgs): Promise<{ fraudGuardBlocked?: boolean } | void>;

  /**
   * Optional: verify an OTP code. When set, Better Auth's phoneNumber plugin
   * delegates verification to this method instead of internal verification.
   * Used by Twilio Verify (which generates its own codes).
   */
  verifyOtp?(args: { phoneNumber: string; code: string }): Promise<boolean>;
}

/**
 * Dev SMS provider: records every sent code (observable in tests) and logs it
 * to the console so local devs can read the OTP to sign in. Dev-only by design —
 * production swaps in a real `SmsProvider`.
 */
export class DevSmsProvider implements SmsProvider {
  readonly sent: SendSmsOtpArgs[] = [];

  sendOtp = async (args: SendSmsOtpArgs): Promise<void> => {
    this.sent.push(args);
    console.log(
      `[DevSmsProvider] SMS-OTP for ${args.phoneNumber}: ${args.code}`,
    );
  };
}

export interface TwilioEnv {
  TWILIO_SID: string;
  TWILIO_AID: string;
  TWILIO_SEC: string;
}

const TWILIO_VERIFY_URL = 'https://verify.twilio.com/v2/Services';

/**
 * Real SMS provider using Twilio Verify (Send + Check Verification Code).
 * Stateless OTP (Twilio Verify handles code generation + verification).
 *
 * Fraud Guard (error 60410): Twilio returns `{ status: 'failed' }` with
 * `send_code_attempts[].attempt_error.code === 60410`. Maps to
 * `{ fraudGuardBlocked: true }` — caller caches this for 12h and short-circuits.
 */
export class TwilioVerifySmsProvider implements SmsProvider {
  private readonly serviceSid: string;
  private readonly authHeader: string;

  constructor(env: TwilioEnv) {
    this.serviceSid = env.TWILIO_SID;
    this.authHeader = `Basic ${btoa(`${env.TWILIO_AID}:${env.TWILIO_SEC}`)}`;
  }

  sendOtp = async (
    args: SendSmsOtpArgs,
  ): Promise<{ fraudGuardBlocked?: boolean } | void> => {
    const url = `${TWILIO_VERIFY_URL}/${this.serviceSid}/Verifications`;
    const body = new URLSearchParams({
      To: args.phoneNumber,
      Channel: 'sms',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('sms.twilio_verify_http_error', {
        status: res.status,
        phoneNumber: args.phoneNumber,
        body: text,
      });
      throw new AppError('sms_failed', `Twilio Verify error: ${res.status}`);
    }

    const data = (await res.json()) as {
      status: string;
      sendCodeAttempts?: Array<{ attempt_error?: { code: number } }>;
    };

    if (data.status === 'failed' || data.status === 'error') {
      const fraudGuard = data.sendCodeAttempts?.some(
        (a) => a.attempt_error?.code === 60410,
      );
      if (fraudGuard) {
        return { fraudGuardBlocked: true };
      }
      throw new AppError(
        'sms_failed',
        `Twilio Verify send failed: status=${data.status}`,
      );
    }
  };

  verifyOtp = async (args: {
    phoneNumber: string;
    code: string;
  }): Promise<boolean> => {
    const url = `${TWILIO_VERIFY_URL}/${this.serviceSid}/VerificationCheck`;
    const body = new URLSearchParams({
      To: args.phoneNumber,
      Code: args.code,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('sms.twilio_verify_check_http_error', {
        status: res.status,
        phoneNumber: args.phoneNumber,
        body: text,
      });
      return false;
    }

    const data = (await res.json()) as {
      valid: boolean;
      status: string;
    };

    return data.valid === true || data.status === 'approved';
  };
}
