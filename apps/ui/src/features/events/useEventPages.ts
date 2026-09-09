import type { UseInfiniteQueryResult } from '@tanstack/react-query';

import type { EventFeedItem } from './api';

interface EventPage {
  readonly items: readonly EventFeedItem[];
  readonly total?: number;
}

export interface EventPagination {
  readonly items: readonly EventFeedItem[];
  readonly total: number | undefined;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
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
 */
export const useEventPages = (
  query: UseInfiniteQueryResult<{ pages: EventPage[] }, unknown>,
  seed: readonly EventFeedItem[] = [],
): EventPagination => {
  const pages = query.data?.pages;
  return {
    items: pages ? pages.flatMap((page) => page.items) : seed,
    total: pages?.find((page) => page.total !== undefined)?.total,
    hasMore: query.hasNextPage === true,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
};
