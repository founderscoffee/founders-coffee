import { useEffect } from 'react';

import type { EventPagination } from './useEventPages';

export type MatchSearch = 'matched' | 'searching' | 'failed' | 'none';

const searchState = (
  pagination: EventPagination,
  matchCount: number,
): MatchSearch => {
  if (matchCount > 0) return 'matched';
  if (!pagination.hasMore) return 'none';
  if (!pagination.isIdle) return 'searching';
  return pagination.hasLoadMoreError ? 'failed' : 'searching';
};

/**
 * Keep loading pages while a filter over the loaded ones leaves nothing to show.
 *
 * A list filtered in the browser sees only the pages it has loaded, so an empty result on the first
 * page says nothing about the pages behind it, and "nothing matches" printed there can be false.
 * This asks for the next page until one holds a match or the last page is in, and returns which of
 * those is still happening, so the list can say it is looking instead of saying nothing matched.
 *
 * It asks only while the list is idle. A request paused offline, or a retry paused in a hidden tab,
 * is still pending although `isLoadingMore` reads false, and asking again would cancel it and start
 * another: in a hidden tab with a failing server, one request a second for as long as the tab stays
 * hidden. After a page fails it does not ask again on its own, since `loadMore` is the retry and the
 * search picks up from there. The item count is a dependency as well as the flag: when a page lands
 * between two renders, the flag can read true both times, and only the count says there is a new
 * page to judge.
 */
export const useLoadUntilMatch = (
  pagination: EventPagination,
  matchCount: number,
): MatchSearch => {
  const search = searchState(pagination, matchCount);
  const shouldLoad = search === 'searching' && pagination.isIdle;
  const { items, loadMore } = pagination;
  useEffect(() => {
    if (shouldLoad) loadMore();
  }, [shouldLoad, items.length]);
  return search;
};
