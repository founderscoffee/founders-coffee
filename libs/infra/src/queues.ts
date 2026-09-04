import { RESOURCES } from './resources.js';

export type QueueKind = keyof typeof RESOURCES.queues;

const DEPLOY_SUFFIXES = ['', '-staging', '-production'] as const;

/**
 * The queue a deployed queue name belongs to, or `null` when it belongs to none of ours.
 *
 * Queues are provisioned per environment, so the name a consumer receives in `batch.queue` is the
 * catalogue name with the environment appended — a shared queue would let a staging message be
 * delivered by production, which is the one thing this naming exists to prevent. The handler still
 * has to route on the catalogue name, so it resolves the deployed name back to it here rather than
 * comparing against a string that only matches in tests.
 *
 * Matching is exact against the three known forms rather than by prefix: `startsWith` would route
 * anything that merely began with a catalogue name, including a queue belonging to somebody else.
 *
 * `null` means unroutable, and the caller must treat that as a failure rather than an acknowledgement
 * — a message acked by a handler that did not recognise its queue is a message silently destroyed.
 */
export const resolveQueueKind = (deployedName: string): QueueKind | null => {
  for (const [kind, name] of Object.entries(RESOURCES.queues)) {
    if (DEPLOY_SUFFIXES.some((suffix) => `${name}${suffix}` === deployedName)) {
      return kind as QueueKind;
    }
  }
  return null;
};

/** The deployed name of one catalogue queue in one environment. */
export const queueName = (
  kind: QueueKind,
  environment: 'staging' | 'production',
): string => `${RESOURCES.queues[kind]}-${environment}`;
