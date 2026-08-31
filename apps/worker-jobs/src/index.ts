import '@founders-coffee/observability/server-init';
import { ok, type Result } from '@founders-coffee/core';
import type { AiRuntime, VectorizeRuntime } from '@founders-coffee/core/ai';
import { createCloudflareEmailProvider } from '@founders-coffee/email';
import { createDb } from '@founders-coffee/db';
import { RESOURCES } from '@founders-coffee/infra';
import {
  DevNotificationSmsProvider,
  FcmPushProvider,
  TwilioProgrammableSmsProvider,
  type NotificationSmsProvider,
  type PushProvider,
} from '@founders-coffee/notifications';

import type { Env } from './env.js';
import { processEmbeddings } from './jobs/embeddings.js';
import type {
  EmbeddingsMessage,
  NotificationMessage,
} from './jobs/messages.js';
import { processNotification } from './jobs/notifications.js';
import { runReconcile } from './jobs/reconcile.js';
import { sweepNotifications } from './jobs/notification-sweep.js';

type JobMessage = EmbeddingsMessage | NotificationMessage;

const createSmsProvider = (env: Env): NotificationSmsProvider => {
  if (env.TWILIO_AID && env.TWILIO_SEC && env.TWILIO_SMS_FROM) {
    return new TwilioProgrammableSmsProvider({
      TWILIO_AID: env.TWILIO_AID,
      TWILIO_SEC: env.TWILIO_SEC,
      TWILIO_SMS_FROM: env.TWILIO_SMS_FROM,
    });
  }
  return new DevNotificationSmsProvider();
};

const createPushProvider = (env: Env): PushProvider | null => {
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_SERVICE_ACCOUNT) {
    return new FcmPushProvider({
      projectId: env.FIREBASE_PROJECT_ID,
      serviceAccountJson: env.FIREBASE_SERVICE_ACCOUNT,
    });
  }
  return null;
};

/** Route one queue message to its consumer. Returns `Result` — the handler acks on ok, retries on err. */
const dispatch = async (
  queue: string,
  body: JobMessage,
  env: Env,
): Promise<Result<unknown>> => {
  const db = createDb(env.DB);
  const email = createCloudflareEmailProvider(env.EMAIL, env.MAIL_FROM);
  const sms = createSmsProvider(env);

  if (queue === RESOURCES.queues.notifications) {
    return processNotification(body as NotificationMessage, { email, sms });
  }
  if (queue === RESOURCES.queues.embeddings) {
    return processEmbeddings(
      env.AI as AiRuntime,
      env.VECTOR as VectorizeRuntime,
      body as EmbeddingsMessage,
    );
  }
  if (queue === RESOURCES.queues.reconcile) {
    return runReconcile(db);
  }
  return ok(undefined);
};

/**
 * apps/worker-jobs — the system worker (no UI). Consumes NOTIFICATIONS
 * (→ SMS + email), EMBEDDINGS (→ AI reindex), RECONCILE (→ payment-backlog
 * sweep). A cron drives reconcile as a backstop + notification sweep for
 * pending scheduled notifications.
 *
 * Per-message ack/retry: a failed message retries individually (no
 * re-sending siblings); exhausted retries fall through to the per-queue DLQ.
 */
export default {
  fetch: () => new Response('ok'),

  scheduled: async (controller: ScheduledController, env: Env) => {
    const db = createDb(env.DB);

    if (controller.cron === '*/1 * * * *') {
      await sweepNotifications(
        db,
        createSmsProvider(env),
        createCloudflareEmailProvider(env.EMAIL, env.MAIL_FROM),
        createPushProvider(env),
      );
    }

    if (controller.cron === '0 3 * * *') {
      await runReconcile(db);
    }
  },

  queue: async (batch: MessageBatch<JobMessage>, env: Env) => {
    for (const message of batch.messages) {
      const result = await dispatch(batch.queue, message.body, env);
      if (result.ok) message.ack();
      else message.retry();
    }
  },
} satisfies ExportedHandler<Env, JobMessage>;
