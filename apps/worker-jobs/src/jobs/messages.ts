import type { ReindexDocument } from '@founders-coffee/core/ai';
import type { SendEmailInput } from '@founders-coffee/email';

export interface EmailNotificationMessage {
  readonly channel: 'email';
  readonly to: string;
  readonly from?: SendEmailInput['from'];
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
}

export interface SmsNotificationMessage {
  readonly channel: 'sms';
  readonly to: string;
  readonly body: string;
}

export type NotificationMessage =
  EmailNotificationMessage | SmsNotificationMessage;

export interface EmbeddingsMessage {
  readonly docs: readonly ReindexDocument[];
}
