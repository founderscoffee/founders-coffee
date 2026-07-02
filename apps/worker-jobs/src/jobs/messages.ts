import type { ReindexDocument } from '@founders-coffee/core/ai';
import type { SendEmailInput } from '@founders-coffee/email';

/** A pre-rendered email notification to dispatch (the producer renders + enqueues). */
export interface EmailNotificationMessage {
  readonly channel: 'email';
  readonly to: string;
  readonly from?: SendEmailInput['from'];
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
}

/** A pre-rendered SMS notification to dispatch. */
export interface SmsNotificationMessage {
  readonly channel: 'sms';
  readonly to: string;
  readonly body: string;
}

/** Discriminated union — consumer checks `message.channel` to route. */
export type NotificationMessage =
  | EmailNotificationMessage
  | SmsNotificationMessage;

/** Documents to re-embed + upsert into Vectorize (the EMBEDDINGS queue payload). */
export interface EmbeddingsMessage {
  readonly docs: readonly ReindexDocument[];
}
