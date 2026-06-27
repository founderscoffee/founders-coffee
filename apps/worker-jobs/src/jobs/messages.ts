import type { ReindexDocument } from '@founders-coffee/core/ai';
import type { SendEmailInput } from '@founders-coffee/email';

/** A pre-rendered notification email to dispatch (the producer — P1-009 — renders + enqueues). */
export interface NotificationMessage {
  readonly to: string;
  readonly from?: SendEmailInput['from'];
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
}

/** Documents to re-embed + upsert into Vectorize (the EMBEDDINGS queue payload). */
export interface EmbeddingsMessage {
  readonly docs: readonly ReindexDocument[];
}
