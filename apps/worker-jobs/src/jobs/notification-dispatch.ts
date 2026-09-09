import type { Db, ScheduledNotification } from '@founders-coffee/db';
import type { notifications } from '@founders-coffee/domain';
import type { EmailProvider } from '@founders-coffee/email';
import type {
  NotificationSmsProvider,
  PushProvider,
} from '@founders-coffee/notifications';

import {
  resolveDestination,
  type Destination,
} from './notification-destination.js';

export type DispatchOutcome =
  | { readonly kind: 'sent' }
  | {
      readonly kind: 'failed';
      readonly permanent: boolean;
      readonly error: string;
      readonly unreachable?: boolean;
      readonly suppressFallback?: boolean;
    };

export type Dispatcher = (
  notification: ScheduledNotification,
  payload: notifications.ParsedNotificationPayload,
) => Promise<DispatchOutcome>;

export interface DispatchProviders {
  readonly sms: NotificationSmsProvider;
  readonly email: EmailProvider;
  readonly push?: PushProvider | null;
}

const sent: DispatchOutcome = { kind: 'sent' };

const failed = (
  error: string,
  permanent: boolean,
  refusal: { unreachable?: boolean; suppressFallback?: boolean } = {},
): DispatchOutcome => ({
  kind: 'failed',
  permanent,
  error,
  ...refusal,
});

/**
 * Every dispatcher resolves its destination first, or does not send at all.
 *
 * The guard is applied here rather than in each channel so that adding a channel cannot
 * accidentally opt out of it: a dispatcher is built by this wrapper or it is not built. An
 * unreachable recipient is permanent — a removed number and a closed account are not conditions a
 * retry in five minutes improves — and an account-level refusal also suppresses the fallback,
 * because writing one would only queue the same refusal on another channel.
 */
const guarded =
  (
    db: Db,
    channel: ScheduledNotification['channel'],
    send: (
      destination: Destination,
      notification: ScheduledNotification,
      parsed: notifications.ParsedNotificationPayload,
    ) => Promise<DispatchOutcome>,
  ): Dispatcher =>
  async (notification, parsed) => {
    if (parsed.channel !== channel)
      return failed(`channel_mismatch: ${parsed.channel}`, true);
    const resolved = await resolveDestination(db, channel, notification.userId);
    if (!resolved.ok)
      return failed(`unreachable: ${resolved.reason}`, true, {
        unreachable: true,
        suppressFallback: resolved.account,
      });
    return send(resolved.destination, notification, parsed);
  };

const smsDispatcher = (db: Db, sms: NotificationSmsProvider): Dispatcher =>
  guarded(db, 'sms', async (destination, notification, parsed) => {
    if (destination.channel !== 'sms' || parsed.channel !== 'sms')
      return failed('channel_mismatch', true);
    const result = await sms.send({
      to: destination.phoneNumber,
      body: parsed.payload.smsBody,
      dedupeKey: notification.id,
    });
    if (result.ok) return sent;
    return failed(
      result.error.message,
      result.error.code === 'sms_permanent_failure',
    );
  });

const emailDispatcher = (db: Db, email: EmailProvider): Dispatcher =>
  guarded(db, 'email', async (destination, notification, parsed) => {
    if (destination.channel !== 'email' || parsed.channel !== 'email')
      return failed('channel_mismatch', true);
    const result = await email.send({
      to: destination.email,
      subject: parsed.payload.subject,
      html: parsed.payload.html,
      text: parsed.payload.text,
      headers: { 'Message-ID': `<${notification.id}@founders.coffee>` },
    });
    return result.ok ? sent : failed(result.error.message, false);
  });

/**
 * A push notification is delivered per device still entitled to receive one.
 *
 * The guard has already excluded devices whose session was signed out, so a member with tokens but
 * no live session is reported unreachable rather than sent to. Having no deliverable device at all
 * is a permanent failure and not a success: nothing was delivered, and recording it as `sent` would
 * both misreport delivery and skip the fallback the row may carry.
 */
const pushDispatcher = (db: Db, push: PushProvider): Dispatcher =>
  guarded(db, 'push', async (destination, notification, parsed) => {
    if (destination.channel !== 'push' || parsed.channel !== 'push')
      return failed('channel_mismatch', true);

    let lastError = 'push delivery failed';
    for (const token of destination.tokens) {
      const result = await push.send({
        token,
        title: parsed.payload.pushTitle,
        body: parsed.payload.pushBody,
        dedupeKey: notification.id,
      });
      if (result.ok) return sent;
      lastError = result.error.message;
    }
    return failed(lastError, false);
  });

export const CHANNEL_SUPPRESSES_DUPLICATES: Record<
  ScheduledNotification['channel'],
  boolean
> = {
  push: true,
  email: false,
  sms: false,
};

/**
 * Build the dispatcher for each channel this deployment can actually deliver on.
 *
 * A channel with no configured provider is deliberately absent rather than mapped to a no-op: the
 * sweep resolves an unroutable row terminally, which is what keeps it out of every later selection
 * window. Push is the only optional channel — it needs Firebase credentials that a deployment may
 * not have.
 *
 * `CHANNEL_SUPPRESSES_DUPLICATES` above records whether redelivering on a channel is invisible to
 * the recipient, which is the whole basis for the sweep's resend decision after an unconfirmed
 * attempt. It is a capability, not a preference. Push qualifies twice over: the Web Push `Topic`
 * header replaces an undelivered copy in transit, and the service worker tags the notification with
 * the same key so a copy that does arrive replaces the one on screen. Email carries a stable
 * `Message-ID`, which receiving systems commonly but not reliably use to collapse a repeat — best
 * effort is not suppression, so it is recorded as `false`. Twilio's Messages resource has no
 * idempotency key at all: a second send is a second billed SMS on someone's phone.
 */
export const buildDispatchers = (
  db: Db,
  providers: DispatchProviders,
): Partial<Record<ScheduledNotification['channel'], Dispatcher>> => ({
  sms: smsDispatcher(db, providers.sms),
  email: emailDispatcher(db, providers.email),
  ...(providers.push ? { push: pushDispatcher(db, providers.push) } : {}),
});
