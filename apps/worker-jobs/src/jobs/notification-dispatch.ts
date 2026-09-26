import type { Db, ScheduledNotification } from '@founders-coffee/db';
import type { notifications } from '@founders-coffee/domain';
import type { EmailProvider } from '@founders-coffee/email';
import type {
  NotificationSmsProvider,
  PushProvider,
  TelegramBotProvider,
} from '@founders-coffee/notifications';

import type { DispatchOutcome, Dispatcher } from './dispatch-outcome.js';
import {
  resolveDestination,
  type Destination,
  type PersonalChannel,
} from './notification-destination.js';
import { telegramDispatcher } from './telegram-dispatch.js';

export interface DispatchProviders {
  readonly sms: NotificationSmsProvider;
  readonly email: EmailProvider;
  readonly push?: PushProvider | null;
  readonly telegram?: TelegramBotProvider | null;
}

const PUSH_ICON = '/android-chrome-192x192.png';

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
    channel: PersonalChannel,
    send: (
      destination: Destination,
      notification: ScheduledNotification,
      parsed: notifications.ParsedNotificationPayload,
    ) => Promise<DispatchOutcome>,
  ): Dispatcher =>
  async (notification, parsed) => {
    if (parsed.channel !== channel)
      return failed(`channel_mismatch: ${parsed.channel}`, true);
    const resolved = await resolveDestination(
      db,
      channel,
      notification.userId,
      notification.templateKey,
      parsed.payload.marketCode,
    );
    if (!resolved.ok)
      return failed(`unreachable: ${resolved.reason}`, !resolved.transient, {
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
  guarded(db, 'email', async (destination, _notification, parsed) => {
    if (destination.channel !== 'email' || parsed.channel !== 'email')
      return failed('channel_mismatch', true);
    const result = await email.send({
      to: destination.email,
      subject: parsed.payload.subject,
      html: parsed.payload.html,
      text: parsed.payload.text,
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
        url: parsed.payload.pushUrl,
        icon: PUSH_ICON,
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
  telegram: false,
};

/**
 * Build the dispatcher for each channel this deployment can actually deliver on.
 *
 * A channel with no configured provider is deliberately absent rather than mapped to a no-op: the
 * sweep resolves an unroutable row terminally, which is what keeps it out of every later selection
 * window. Push and Telegram are the optional channels: push needs Firebase credentials and Telegram
 * a bot token, and a deployment may have neither.
 *
 * `CHANNEL_SUPPRESSES_DUPLICATES` above records whether redelivering on a channel is invisible to
 * the recipient, which is the whole basis for the sweep's resend decision after an unconfirmed
 * attempt. It is a capability, not a preference. Push qualifies twice over: the Web Push `Topic`
 * header replaces an undelivered copy in transit, and the service worker tags the notification with
 * the same key so a copy that does arrive replaces the one on screen. Email is `false` and now has
 * nothing to argue about: it used to set its own `Message-ID`, which Cloudflare's Email Sending
 * rejects outright — `E_VALIDATION_ERROR` on every notification, while the OTP path that sets no
 * headers has always worked. The header is gone, Cloudflare assigns its own, and a repeat is a
 * second message in the inbox. Twilio's Messages resource has no idempotency key at all: a second
 * send is a second billed SMS on someone's phone. Telegram's Bot API has none either, and a second
 * `sendMessage` is a second post in front of a whole group.
 */
export const buildDispatchers = (
  db: Db,
  providers: DispatchProviders,
): Partial<Record<ScheduledNotification['channel'], Dispatcher>> => ({
  sms: smsDispatcher(db, providers.sms),
  email: emailDispatcher(db, providers.email),
  ...(providers.push ? { push: pushDispatcher(db, providers.push) } : {}),
  ...(providers.telegram
    ? { telegram: telegramDispatcher(db, providers.telegram) }
    : {}),
});
