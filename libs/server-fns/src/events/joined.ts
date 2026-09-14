import {
  countJoinedEvents,
  listJoinedEvents,
  type Db,
} from '@founders-coffee/db';

import { attachCityNames, type EventFeedPage } from './resolver.js';

export interface JoinedEventPage extends EventFeedPage {
  readonly total: number;
}

/**
 * One page of the gatherings a member has joined, newest first, with the total beside it.
 *
 * Deliberately the same shape as `listHostedEventPage`: the two sit side by side on the member's
 * own activity screen, share a pagination component, and a member reading them should not have to
 * hold two ideas of what "next page" means.
 *
 * The `userId` is never taken from the client. This is the only list in the product that answers
 * "where has this person been", which is exactly the question a public endpoint must not answer —
 * the RPC above it reads the session and passes the caller's own id, so asking about somebody else
 * is not a permission that can be forgotten but a parameter that does not exist.
 */
export const listJoinedEventPage = async (
  db: Db,
  opts: {
    userId: string;
    marketCode?: string;
    beforeStartsAt?: number;
    beforeId?: string;
    limit?: number;
  },
): Promise<JoinedEventPage> => {
  const limit = opts.limit ?? 20;
  const [rows, total] = await Promise.all([
    listJoinedEvents(db, {
      userId: opts.userId,
      marketCode: opts.marketCode,
      beforeStartsAt: opts.beforeStartsAt
        ? new Date(opts.beforeStartsAt)
        : undefined,
      beforeId: opts.beforeId,
      limit: limit + 1,
    }),
    countJoinedEvents(db, {
      userId: opts.userId,
      marketCode: opts.marketCode,
    }),
  ]);
  const items = attachCityNames(rows.slice(0, limit));
  const last = items[items.length - 1];
  return {
    items,
    total,
    nextCursor:
      rows.length > limit && last
        ? { startsAt: last.startsAt.getTime(), id: last.id }
        : null,
  };
};
