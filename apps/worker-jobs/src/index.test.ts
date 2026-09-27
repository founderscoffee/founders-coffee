import {
  createExecutionContext,
  createMessageBatch,
  createScheduledController,
  env,
  getQueueResult,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { id } from '@founders-coffee/core';
import { queueName, RESOURCES } from '@founders-coffee/infra';

import type { NotificationDueMessage } from './jobs/messages.js';
import worker from './index.js';
import { eq, user, type Db } from '@founders-coffee/db';

import {
  EVENT_ID,
  MEMBER_ID,
  enqueue,
  rowById,
  setupDb,
} from './jobs/notification-sweep.fixtures.js';

const memberEmail = async (db: Db, email: string): Promise<void> => {
  await db.update(user).set({ email }).where(eq(user.id, MEMBER_ID)).run();
};

const runHandler = async (
  eventId: string,
  queue = RESOURCES.queues.notifications,
) => {
  const batch = createMessageBatch<NotificationDueMessage>(queue, [
    {
      body: { kind: 'notification_due', eventId },
      timestamp: new Date(),
      attempts: 1,
    },
  ]);
  const ctx = createExecutionContext();
  await worker.queue(batch, env, ctx);
  return getQueueResult(batch, ctx);
};

describe('queue handler — NOTIFICATIONS (real Miniflare bindings)', () => {
  it('acks a due message and marks the row it delivered', async () => {
    const db = await setupDb();
    await memberEmail(db, 'ok@example.com');
    const rowId = await enqueue(db, { channel: 'email' });

    const result = await runHandler(EVENT_ID);

    expect(result.explicitAcks).toHaveLength(1);
    expect(result.retryMessages).toHaveLength(0);
    expect((await rowById(db, rowId))?.status).toBe('sent');
  });

  it('acks a message whose delivery failed, because the row carries that outcome', async () => {
    const db = await setupDb();
    await memberEmail(db, 'blocked@example.com');
    const rowId = await enqueue(db, { channel: 'email' });

    const result = await runHandler(EVENT_ID);

    expect(result.explicitAcks).toHaveLength(1);
    expect(result.retryMessages).toHaveLength(0);
    expect((await rowById(db, rowId))?.status).not.toBe('sent');
  });

  it('really processes a message arriving on the environment-suffixed queue name', async () => {
    const db = await setupDb();
    await memberEmail(db, 'ok@example.com');
    const rowId = await enqueue(db, { channel: 'email' });

    const result = await runHandler(
      EVENT_ID,
      queueName('notifications', 'staging'),
    );

    expect(result.explicitAcks).toHaveLength(1);
    expect((await rowById(db, rowId))?.status).toBe('sent');
  });

  it('retries rather than acks a message from a queue it cannot route', async () => {
    await setupDb();

    const result = await runHandler(EVENT_ID, 'not-one-of-ours');

    expect(result.retryMessages).toHaveLength(1);
    expect(result.explicitAcks).toHaveLength(0);
  });
});

describe('scheduled handler — the daily run (real Miniflare bindings)', () => {
  it('erases an account whose closure is due (#105)', async () => {
    const db = await setupDb();
    const userId = id('usr');
    await db.insert(user).values({
      id: userId,
      name: 'Closing Member',
      email: `${userId}@closure.test`,
      accountState: 'closing',
      closedAt: new Date(Date.now() - 3_600_000),
    });

    await worker.scheduled(
      createScheduledController({ cron: '0 3 * * *' }),
      env,
    );

    const [row] = await db.select().from(user).where(eq(user.id, userId));
    expect(row).toMatchObject({ accountState: 'deleted', name: '' });
  });
});
