import { getPushTokensByUser, type Db } from '@founders-coffee/db';
import type { ScheduledNotification } from '@founders-coffee/db';
import type { EmailProvider } from '@founders-coffee/email';
import type {
  NotificationSmsProvider,
  PushProvider,
} from '@founders-coffee/notifications';

export type DispatchOutcome =
  | { readonly kind: 'sent' }
  | {
      readonly kind: 'failed';
      readonly permanent: boolean;
      readonly error: string;
    };

export type Dispatcher = (
  notification: ScheduledNotification,
) => Promise<DispatchOutcome>;

export interface DispatchProviders {
  readonly sms: NotificationSmsProvider;
  readonly email: EmailProvider;
  readonly push?: PushProvider | null;
}

const sent: DispatchOutcome = { kind: 'sent' };

const failed = (error: string, permanent: boolean): DispatchOutcome => ({
  kind: 'failed',
  permanent,
  error,
});

const smsDispatcher =
  (sms: NotificationSmsProvider): Dispatcher =>
  async (notification) => {
    const payload = notification.payload as {
      phoneNumber: string;
      smsBody: string;
    };
    const result = await sms.send({
      to: payload.phoneNumber,
      body: payload.smsBody,
    });
    if (result.ok) return sent;
    return failed(
      result.error.message,
      result.error.code === 'sms_permanent_failure',
    );
  };

const emailDispatcher =
  (email: EmailProvider): Dispatcher =>
  async (notification) => {
    const payload = notification.payload as {
      email: string;
      subject: string;
      html: string;
      text?: string;
    };
    const result = await email.send({
      to: payload.email,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    return result.ok ? sent : failed(result.error.message, false);
  };

/**
 * A push notification is delivered per registered device token.
 *
 * A user with no registered token is a permanent failure, not a success: nothing was delivered, and
 * recording it as `sent` would both misreport delivery and skip the fallback the row may carry.
 */
const pushDispatcher =
  (db: Db, push: PushProvider): Dispatcher =>
  async (notification) => {
    const tokens = await getPushTokensByUser(db, {
      userId: notification.userId,
    });
    if (tokens.length === 0) {
      return failed('no_push_tokens: user has no registered device', true);
    }

    const payload = notification.payload as {
      pushTitle: string;
      pushBody: string;
    };
    let lastError = 'push delivery failed';
    for (const token of tokens) {
      const result = await push.send({
        token: token.token,
        title: payload.pushTitle,
        body: payload.pushBody,
      });
      if (result.ok) return sent;
      lastError = result.error.message;
    }
    return failed(lastError, false);
  };

/**
 * Build the dispatcher for each channel this deployment can actually deliver on.
 *
 * A channel with no configured provider is deliberately absent rather than mapped to a no-op: the
 * sweep resolves an unroutable row terminally, which is what keeps it out of every later selection
 * window. Push is the only optional channel — it needs Firebase credentials that a deployment may
 * not have.
 */
export const buildDispatchers = (
  db: Db,
  providers: DispatchProviders,
): Partial<Record<ScheduledNotification['channel'], Dispatcher>> => ({
  sms: smsDispatcher(providers.sms),
  email: emailDispatcher(providers.email),
  ...(providers.push ? { push: pushDispatcher(db, providers.push) } : {}),
});
