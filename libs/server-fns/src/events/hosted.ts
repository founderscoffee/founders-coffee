import {
  countHostedEvents,
  hostedMeetupsOnRecord,
  listHostedEvents,
  type Db,
} from '@founders-coffee/db';

import {
  attachCityNames,
  type EventFeedItemBase,
  type EventFeedPage,
} from './resolver.js';

export type HostedEventItem = EventFeedItemBase & {
  readonly isOnRecord: boolean;
};

export interface HostedEventPage extends EventFeedPage {
  readonly items: readonly HostedEventItem[];
  readonly total: number;
}

/**
 * One page of a host's event history, newest first, with the total beside it.
 *
 * `total` is a `COUNT(*)` over the predicate the pages walk, not the length of anything already
 * fetched — the public profile used to report the size of its first page of at most twenty as
 * though it were a lifetime figure, so a host of thirty gatherings read as a host of twenty. It is
 * returned on every page because the aggregate is cheap and a stale total beside a growing list is
 * worse than no total.
 *
 * `isOnRecord` marks the meetups the host's public record counts as having taken place, so the
 * profile can tag them and the count above the list matches the tagged meetups in it.
 */
export const listHostedEventPage = async (
  db: Db,
  opts: {
    hostId: string;
    marketCode?: string;
    beforeStartsAt?: number;
    beforeId?: string;
    limit?: number;
  },
): Promise<HostedEventPage> => {
  const limit = opts.limit ?? 20;
  const [rows, total] = await Promise.all([
    listHostedEvents(db, {
      hostId: opts.hostId,
      marketCode: opts.marketCode,
      beforeStartsAt: opts.beforeStartsAt
        ? new Date(opts.beforeStartsAt)
        : undefined,
      beforeId: opts.beforeId,
      limit: limit + 1,
    }),
    countHostedEvents(db, {
      hostId: opts.hostId,
      marketCode: opts.marketCode,
    }),
  ]);
  const page = rows.slice(0, limit);
  const onRecord = await hostedMeetupsOnRecord(
    db,
    opts.hostId,
    page.map((row) => row.id),
    new Date(),
  );
  const items = attachCityNames(page).map((item) => ({
    ...item,
    isOnRecord: onRecord.has(item.id),
  }));
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
