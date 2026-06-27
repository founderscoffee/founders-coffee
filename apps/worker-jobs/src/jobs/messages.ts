import type { SendEmailInput } from '@founders-coffee/email';

/** A pre-rendered notification email to dispatch (the producer — P1-009 — renders + enqueues). */
export interface NotificationMessage {
  readonly to: string;
  readonly from?: SendEmailInput['from'];
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
}
