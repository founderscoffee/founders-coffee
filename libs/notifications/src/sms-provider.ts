/**
 * Notification SMS provider — sends arbitrary notification messages via
 * Twilio Programmable SMS (AGENTS.md §11.7: external services behind a
 * provider interface). Distinct from `libs/auth`'s OTP-only `SmsProvider`
 * (which uses the Twilio Verify API). Same Twilio account, different API.
 *
 * The dev variant logs messages to console for local development.
 */

import { AppError, type Result, ok, err } from '@founders-coffee/core';

export interface SendNotificationSmsArgs {
  readonly to: string;
  readonly body: string;
}

export interface SendNotificationSmsResult {
  readonly sid: string;
  readonly segments: number;
}

/**
 * Provider for sending notification SMS (not OTP). The real variant uses
 * Twilio Programmable SMS (Messages API); the dev variant logs to console.
 */
export interface NotificationSmsProvider {
  readonly name: string;
  send(
    args: SendNotificationSmsArgs,
  ): Promise<Result<SendNotificationSmsResult>>;
}

/**
 * Twilio Programmable SMS credentials (separate from Verify SID).
 * `TWILIO_AID` and `TWILIO_SEC` are shared; `TWILIO_SMS_FROM` is the
 * alphanumeric sender ID (pre-registered for Algeria — AGENTS.md §10).
 */
export interface TwilioSmsEnv {
  TWILIO_AID: string;
  TWILIO_SEC: string;
  TWILIO_SMS_FROM: string;
}

const TWILIO_MESSAGES_URL =
  'https://api.twilio.com/2010-04-01/Accounts';

/**
 * Real SMS provider using Twilio Programmable SMS (Messages API).
 * Stateless — no code generation (that's Verify's job).
 *
 * Sends arbitrary text messages for notifications (RSVP confirmations,
 * reminders). Pricing: ~$0.26/segment in Algeria.
 *
 * Error codes mapped:
 * - 21211 (invalid number) → permanent failure
 * - 21614 (not mobile) → permanent failure
 * - All others → transient (retryable)
 */
export class TwilioProgrammableSmsProvider
  implements NotificationSmsProvider
{
  readonly name = 'twilio-sms';
  private readonly authHeader: string;
  private readonly fromNumber: string;

  constructor(env: TwilioSmsEnv) {
    this.authHeader = `Basic ${btoa(`${env.TWILIO_AID}:${env.TWILIO_SEC}`)}`;
    this.fromNumber = env.TWILIO_SMS_FROM;
  }

  send = async (
    args: SendNotificationSmsArgs,
  ): Promise<Result<SendNotificationSmsResult>> => {
    const url = `${TWILIO_MESSAGES_URL}/${btoa(this.authHeader.replace('Basic ', ''))}/Messages.json`;
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

        const isPermanent =
          data.code === 21211 || data.code === 21614;

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

/**
 * Dev SMS provider: logs every message to the console so local devs can
 * read notification texts. Dev-only by design — production swaps in
 * `TwilioProgrammableSmsProvider`.
 *
 * Records all sent messages in the `sent` array for test assertions
 * (same pattern as `DevSmsProvider` in `libs/auth`).
 */
export class DevNotificationSmsProvider
  implements NotificationSmsProvider
{
  readonly name = 'dev-sms';
  readonly sent: SendNotificationSmsArgs[] = [];

  send = async (
    args: SendNotificationSmsArgs,
  ): Promise<Result<SendNotificationSmsResult>> => {
    this.sent.push(args);
    console.log(
      `[DevNotificationSmsProvider] SMS to ${args.to}: ${args.body}`,
    );
    return ok({ sid: `dev_sms_${Date.now()}`, segments: 1 });
  };
}
