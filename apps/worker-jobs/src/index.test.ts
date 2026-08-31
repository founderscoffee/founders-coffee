import {
  createExecutionContext,
  createMessageBatch,
  env,
  getQueueResult,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { RESOURCES } from '@founders-coffee/infra';

import type { NotificationMessage } from './jobs/messages.js';
import worker from './index.js';

const runHandler = async (to: string) => {
  const batch = createMessageBatch<NotificationMessage>(
    RESOURCES.queues.notifications,
    [
      {
        body: {
          to,
          subject: 'RSVP confirmed',
          html: '<p>See you Saturday.</p>',
        },
        timestamp: new Date(),
        attempts: 1,
      },
    ],
  );
  const ctx = createExecutionContext();
  await worker.queue(batch, env, ctx);
  return getQueueResult(batch, ctx);
};

describe('queue handler — NOTIFICATIONS (real Miniflare EMAIL binding)', () => {
  it('acks a notification that dispatches to an allowed recipient', async () => {
    const result = await runHandler('ok@example.com');

    expect(result.explicitAcks).toHaveLength(1);
    expect(result.retryMessages).toHaveLength(0);
  });

  it('retries a notification to a disallowed recipient (provider returns err)', async () => {
    const result = await runHandler('blocked@example.com');

    expect(result.retryMessages).toHaveLength(1);
    expect(result.explicitAcks).toHaveLength(0);
  });
});
