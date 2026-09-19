import { AppError } from '@founders-coffee/core';
import { logger } from '@founders-coffee/observability';

export interface SendSmsOtpArgs {
  phoneNumber: string;
  code: string;
}

export interface SmsProvider {
  sendOtp(
    args: SendSmsOtpArgs,
  ): Promise<{ fraudGuardBlocked?: boolean } | void>;

  verifyOtp?(args: { phoneNumber: string; code: string }): Promise<boolean>;
}

export class DevSmsProvider implements SmsProvider {
  readonly sent: SendSmsOtpArgs[] = [];

  sendOtp = async (args: SendSmsOtpArgs): Promise<void> => {
    this.sent.push(args);
    // eslint-disable-next-line no-console -- dev OTP: sanitize would redact it
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
