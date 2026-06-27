import { ok } from '@founders-coffee/core';
import { createCloudflareEmailProvider } from '@founders-coffee/email';
import { RESOURCES } from '@founders-coffee/infra';

import type { Env } from './env.js';
import type { NotificationMessage } from './jobs/messages.js';
import { processNotification } from './jobs/notifications.js';

const DEFAULT_FROM = 'noreply@founders.coffee';

/**
 * apps/worker-jobs — the system worker (no UI). Consumes the NOTIFICATIONS queue (EMBEDDINGS +
 * RECONCILE land in the next commit) + a cron backstop. Per-message ack/retry: a failed message is
 * retried individually (no re-sending siblings); `max_retries` exhausts into the DLQ.
 */
export default {
  fetch: () => new Response('ok'),

  queue: async (batch: MessageBatch<NotificationMessage>, env: Env) => {
    for (const message of batch.messages) {
      const result =
        batch.queue === RESOURCES.queues.notifications
          ? await processNotification(createCloudflareEmailProvider(env.EMAIL, DEFAULT_FROM), message.body)
          : ok(undefined);
      if (result.ok) message.ack();
      else message.retry();
    }
  },
} satisfies ExportedHandler<Env, NotificationMessage>;
