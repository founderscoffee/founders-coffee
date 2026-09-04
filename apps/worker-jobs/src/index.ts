import '@founders-coffee/observability/server-init';
import { AppError, err, type Result } from '@founders-coffee/core';
import type { AiRuntime, VectorizeRuntime } from '@founders-coffee/core/ai';
import { createCloudflareEmailProvider } from '@founders-coffee/email';
import { createDb } from '@founders-coffee/db';
import { resolveQueueKind } from '@founders-coffee/infra';
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

/**
 * Route one queue message to its consumer. Returns `Result` — the handler acks on ok, retries on err.
 *
 * The queue name arrives with its environment appended, because each environment has its own queues,
 * so it is resolved back to the catalogue name rather than compared to one. A name that resolves to
 * nothing is a failure and not an acknowledgement: acking a message whose queue this Worker does not
 * recognise destroys it silently, and the retries then carry it to the dead-letter queue where it can
 * be looked at.
 */
const dispatch = async (
  queue: string,
  body: JobMessage,
  env: Env,
): Promise<Result<unknown>> => {
  const kind = resolveQueueKind(queue);
  if (kind === null) {
    return err(
      new AppError('queue_unroutable', `No consumer for queue "${queue}"`),
    );
  }

  const db = createDb(env.DB);

  if (kind === 'notifications') {
    return processNotification(body as NotificationMessage, {
      email: createCloudflareEmailProvider(env.EMAIL, env.MAIL_FROM),
      sms: createSmsProvider(env),
    });
  }
  if (kind === 'embeddings') {
    return processEmbeddings(
      env.AI as AiRuntime,
      env.VECTOR as VectorizeRuntime,
      body as EmbeddingsMessage,
    );
  }
  return runReconcile(db);
};

export default {
  fetch: () => new Response('ok'),

  scheduled: async (controller: ScheduledController, env: Env) => {
    const db = createDb(env.DB);

    if (controller.cron === '*/1 * * * *') {
      await sweepNotifications(db, {
        sms: createSmsProvider(env),
        email: createCloudflareEmailProvider(env.EMAIL, env.MAIL_FROM),
        push: createPushProvider(env),
      });
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
