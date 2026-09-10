import type { ReindexDocument } from '@founders-coffee/core/ai';

export interface NotificationDueMessage {
  readonly kind: 'notification_due';
  readonly eventId: string;
}

export interface EmbeddingsMessage {
  readonly docs: readonly ReindexDocument[];
}
