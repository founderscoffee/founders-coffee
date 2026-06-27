import type { Result } from '@founders-coffee/core';
import type { EmailProvider, SendEmailResult } from '@founders-coffee/email';

import type { NotificationMessage } from './messages.js';

/**
 * Dispatch one notification email via the injected provider. The handler builds the provider from
 * `env.EMAIL`; injecting it keeps this pure + testable with a fake (AGENTS.md §11.5). Returns the
 * provider's `Result` — the handler acks on ok, retries on err (→ DLQ after `max_retries`).
 */
export const processNotification = (
  email: EmailProvider,
  message: NotificationMessage,
): Promise<Result<SendEmailResult>> =>
  email.send({
    to: message.to,
    from: message.from,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
