import type { UseInfiniteQueryResult } from '@tanstack/react-query';

import type { EventFeedItem } from './api';

interface EventPage<Item> {
  readonly items: readonly Item[];
  readonly total?: number;
}

export interface EventPagination<Item = EventFeedItem> {
  readonly items: readonly Item[];
  readonly total: number | undefined;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly isIdle: boolean;
  readonly hasLoadMoreError: boolean;
  readonly loadMore: () => void;
}

/**
 * Flatten a paged event query into the shape a list needs.
 *
 * Three screens each kept their own `data?.pages.flatMap(...)` beside their own load-more button,
 * which is how the public profile ended up with no pagination at all — there was nothing to reuse,
 * only something to copy. Every caller now reads the same fields, so a fourth list is a call rather
 * than another transcription.
 *
 * `seed` is the server-rendered first page. Showing it until the query resolves is what keeps the
 * feed from flashing empty on first paint, and it is dropped the moment real pages arrive.
 *
 * `total` comes from whichever page carries one — an aggregate over the whole predicate rather than
 * the number of rows fetched so far, so a list showing twenty of thirty can say so.
 *
 * `isIdle` is true when no request for the list is running or waiting to resume. A request can wait:
 * offline, or when a retry falls due in a hidden tab, it is paused rather than failed, and while
 * paused `isLoadingMore` reads false although a request is still pending.
 *
 * `hasLoadMoreError` means the last request for the next page failed, and only that. A first load or
 * a refetch that failed is the query's own error, which asking for the next page again would not fix.
 * It stays true while the page is asked for again, since a query that has data keeps its error until
 * the next request settles, so a list that says the page failed waits for `isIdle` as well.
 */
export const useEventPages = <Item extends EventFeedItem = EventFeedItem>(
  query: UseInfiniteQueryResult<{ pages: EventPage<Item>[] }, unknown>,
  seed: readonly Item[] = [],
): EventPagination<Item> => {
  const pages = query.data?.pages;
  return {
    items: pages ? pages.flatMap((page) => page.items) : seed,
    total: pages?.find((page) => page.total !== undefined)?.total,
    hasMore: query.hasNextPage === true,
    isLoadingMore: query.isFetchingNextPage,
    isIdle: query.fetchStatus === 'idle',
    hasLoadMoreError: query.isFetchNextPageError === true,
    loadMore: () => void query.fetchNextPage(),
  };
};
