import type { Result } from '@founders-coffee/core';
import type { EmailProvider, SendEmailResult } from '@founders-coffee/email';
import type {
  NotificationSmsProvider,
  SendNotificationSmsResult,
} from '@founders-coffee/notifications';

import type { NotificationMessage } from './messages.js';

/**
 * Dispatch one notification via the appropriate provider. The handler routes
 * based on `message.channel`: SMS → `NotificationSmsProvider`, email →
 * `EmailProvider`. Returns the provider's `Result` — the handler acks on ok,
 * retries on err (→ DLQ after `max_retries`).
 */
export const processNotification = async (
  message: NotificationMessage,
  deps: {
    email: EmailProvider;
    sms: NotificationSmsProvider;
  },
): Promise<Result<SendEmailResult | SendNotificationSmsResult>> => {
  if (message.channel === 'sms') {
    return deps.sms.send({ to: message.to, body: message.body });
  }
  return deps.email.send({
    to: message.to,
    from: message.from,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
};
