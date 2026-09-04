import { describe, expect, it } from 'vitest';

import { queueName, resolveQueueKind } from './queues.js';
import { RESOURCES } from './resources.js';

describe('resolveQueueKind', () => {
  it('resolves every catalogue queue in both deployed environments', () => {
    for (const kind of ['notifications', 'embeddings', 'reconcile'] as const) {
      expect(resolveQueueKind(queueName(kind, 'staging'))).toBe(kind);
      expect(resolveQueueKind(queueName(kind, 'production'))).toBe(kind);
    }
  });

  it('resolves the bare catalogue name, which is what Miniflare uses', () => {
    expect(resolveQueueKind(RESOURCES.queues.notifications)).toBe(
      'notifications',
    );
  });

  it('does not route a name that merely starts with one of ours', () => {
    expect(
      resolveQueueKind(`${RESOURCES.queues.notifications}-somebody-else`),
    ).toBeNull();
    expect(resolveQueueKind('founders-coffee-notifications-prod')).toBeNull();
  });

  it('does not route an unknown queue, so the caller can refuse to ack it', () => {
    expect(resolveQueueKind('some-other-queue')).toBeNull();
    expect(resolveQueueKind('')).toBeNull();
  });

  it('keeps staging and production names distinct', () => {
    expect(queueName('notifications', 'staging')).not.toBe(
      queueName('notifications', 'production'),
    );
  });
});
