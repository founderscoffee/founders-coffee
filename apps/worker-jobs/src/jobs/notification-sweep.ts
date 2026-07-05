import { getPushTokensByUser, listPendingNotifications, markNotificationFailed, markNotificationSent } from '@founders-coffee/db';
import type { Db } from '@founders-coffee/db';
import type { EmailProvider } from '@founders-coffee/email';
import type { NotificationSmsProvider, PushProvider } from '@founders-coffee/notifications';

const SWEEP_LIMIT = 100;

/**
 * Cron-driven sweep: picks up pending notifications where send_at is due,
 * dispatches via the appropriate provider, and marks them sent/failed.
 * Runs every minute via the notification sweep Cron trigger.
 *
 * If an SMS fails permanently (invalid number, not mobile), and the
 * notification has a fallbackChannel, a new pending row is created
 * on the fallback channel (email fallback for SMS failure).
 */
export const sweepNotifications = async (
  db: Db,
  sms: NotificationSmsProvider,
  email: EmailProvider,
  push?: PushProvider | null,
): Promise<void> => {
  const now = new Date();
  const pending = await listPendingNotifications(db, {
    limit: SWEEP_LIMIT,
    now,
  });

  for (const notification of pending) {
    const { channel, payload } = notification;

    if (channel === 'sms') {
      const result = await sms.send({
        to: (payload as { phoneNumber: string }).phoneNumber,
        body: (payload as { smsBody: string }).smsBody,
      });

      if (result.ok) {
        await markNotificationSent(db, { id: notification.id });
      } else {
        const isPermanent =
          result.error.code === 'sms_permanent_failure';
        await markNotificationFailed(db, {
          id: notification.id,
          error: result.error.message,
          canFallback: isPermanent,
        });
      }
    } else if (channel === 'email') {
      const result = await email.send({
        to: (payload as { email: string }).email,
        subject: (payload as { subject: string }).subject,
        html: (payload as { html: string }).html,
        text: (payload as { text: string }).text,
      });

      if (result.ok) {
        await markNotificationSent(db, { id: notification.id });
      } else {
        await markNotificationFailed(db, {
          id: notification.id,
          error: result.error.message,
          canFallback: false,
        });
      }
    } else if (channel === 'push' && push) {
      const tokens = await getPushTokensByUser(db, { userId: notification.userId });
      const pushPayload = payload as { pushTitle: string; pushBody: string };
      let anyOk = tokens.length === 0;
      for (const t of tokens) {
        const result = await push.send({ token: t.token, title: pushPayload.pushTitle, body: pushPayload.pushBody });
        if (result.ok) anyOk = true;
      }
      if (anyOk) {
        await markNotificationSent(db, { id: notification.id });
      } else {
        await markNotificationFailed(db, { id: notification.id, error: 'Push delivery failed', canFallback: false });
      }
    }
  }
};
