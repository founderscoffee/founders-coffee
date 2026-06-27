import { ok, type Result } from '@founders-coffee/core';
import type { AiRuntime, VectorizeRuntime } from '@founders-coffee/core/ai';
import { createCloudflareEmailProvider } from '@founders-coffee/email';
import { createDb } from '@founders-coffee/db';
import { RESOURCES } from '@founders-coffee/infra';

import type { Env } from './env.js';
import { processEmbeddings } from './jobs/embeddings.js';
import type { EmbeddingsMessage, NotificationMessage } from './jobs/messages.js';
import { processNotification } from './jobs/notifications.js';
import { runReconcile } from './jobs/reconcile.js';

const DEFAULT_FROM = 'noreply@founders.coffee';

type JobMessage = EmbeddingsMessage | NotificationMessage;

/** Route one queue message to its consumer. Returns `Result` — the handler acks on ok, retries on err. */
const dispatch = async (queue: string, body: JobMessage, env: Env): Promise<Result<unknown>> => {
  if (queue === RESOURCES.queues.notifications) {
    return processNotification(createCloudflareEmailProvider(env.EMAIL, DEFAULT_FROM), body as NotificationMessage);
  }
  if (queue === RESOURCES.queues.embeddings) {
    return processEmbeddings(
      env.AI as AiRuntime,
      env.VECTOR as VectorizeRuntime,
      body as EmbeddingsMessage,
    );
  }
  if (queue === RESOURCES.queues.reconcile) {
    return runReconcile(createDb(env.DB));
  }
  return ok(undefined);
};

/**
 * apps/worker-jobs — the system worker (no UI). Consumes NOTIFICATIONS (→ email), EMBEDDINGS (→ AI
 * reindex), RECONCILE (→ payment-backlog sweep); a daily cron drives reconcile as a backstop.
 * Per-message ack/retry: a failed message retries individually (no re-sending siblings); exhausted
 * retries fall through to the per-queue DLQ. DO Alarms (P1-010) own per-entity scheduling, not this cron.
 */
export default {
  fetch: () => new Response('ok'),

  scheduled: async (_controller: ScheduledController, env: Env) => {
    await runReconcile(createDb(env.DB));
  },

  queue: async (batch: MessageBatch<JobMessage>, env: Env) => {
    for (const message of batch.messages) {
      const result = await dispatch(batch.queue, message.body, env);
      if (result.ok) message.ack();
      else message.retry();
    }
  },
} satisfies ExportedHandler<Env, JobMessage>;
