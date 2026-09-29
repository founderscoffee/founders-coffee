import type { ReindexDocument } from '@founders-coffee/core/ai';

export type { NotificationDueMessage } from '@founders-coffee/core';

export interface EmbeddingsMessage {
  readonly docs: readonly ReindexDocument[];
}
