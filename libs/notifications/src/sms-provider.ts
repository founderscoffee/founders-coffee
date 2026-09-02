import { AppError, type Result, ok, err } from '@founders-coffee/core';

export interface SendNotificationSmsArgs {
  readonly to: string;
  readonly body: string;
  readonly dedupeKey?: string;
}

export interface SendNotificationSmsResult {
  readonly sid: string;
  readonly segments: number;
}

export interface NotificationSmsProvider {
  readonly name: string;
  send(
    args: SendNotificationSmsArgs,
  ): Promise<Result<SendNotificationSmsResult>>;
}

export interface TwilioSmsEnv {
  TWILIO_AID: string;
  TWILIO_SEC: string;
  TWILIO_SMS_FROM: string;
}

const TWILIO_MESSAGES_URL = 'https://api.twilio.com/2010-04-01/Accounts';

export class TwilioProgrammableSmsProvider implements NotificationSmsProvider {
  readonly name = 'twilio-sms';
  private readonly accountSid: string;
  private readonly authHeader: string;
  private readonly fromNumber: string;

  constructor(env: TwilioSmsEnv) {
    this.accountSid = env.TWILIO_AID;
    this.authHeader = `Basic ${btoa(`${env.TWILIO_AID}:${env.TWILIO_SEC}`)}`;
    this.fromNumber = env.TWILIO_SMS_FROM;
  }

  /**
   * Send one SMS through Twilio's Messages resource.
   *
   * `dedupeKey` is accepted for parity with the other channels and for logging only: Messages has
   * no idempotency key, so nothing here can suppress a duplicate. The sweep is what decides not to
   * resend an SMS whose previous attempt was unconfirmed.
   */
  send = async (
    args: SendNotificationSmsArgs,
  ): Promise<Result<SendNotificationSmsResult>> => {
    const url = `${TWILIO_MESSAGES_URL}/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: args.to,
      From: this.fromNumber,
      Body: args.body,
    });

    try {
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
        const data = JSON.parse(text) as {
          code?: number;
          message?: string;
        };

        const isPermanent = data.code === 21211 || data.code === 21614;

        return err(
          new AppError(
            isPermanent ? 'sms_permanent_failure' : 'sms_transient_failure',
            `Twilio SMS error ${res.status}: ${data.message ?? text}`,
          ),
        );
      }

      const data = (await res.json()) as {
        sid: string;
        num_segments: string;
      };

      return ok({
        sid: data.sid,
        segments: parseInt(data.num_segments, 10) || 1,
      });
    } catch (error) {
      return err(
        new AppError(
          'sms_transient_failure',
          `Twilio SMS network error: ${error instanceof Error ? error.message : 'unknown'}`,
        ),
      );
    }
  };
}

export class DevNotificationSmsProvider implements NotificationSmsProvider {
  readonly name = 'dev-sms';
  readonly sent: SendNotificationSmsArgs[] = [];

  send = async (
    args: SendNotificationSmsArgs,
  ): Promise<Result<SendNotificationSmsResult>> => {
    this.sent.push(args);
    console.log(`[DevNotificationSmsProvider] SMS to ${args.to}: ${args.body}`);
    return ok({ sid: `dev_sms_${Date.now()}`, segments: 1 });
  };
}
