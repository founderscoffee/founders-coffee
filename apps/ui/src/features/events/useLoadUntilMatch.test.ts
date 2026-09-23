import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventFeedItem } from './api';
import type { EventPagination } from './useEventPages';
import { useLoadUntilMatch } from './useLoadUntilMatch';

const item = (id: string) => ({ id }) as unknown as EventFeedItem;

const loadMore = vi.fn();

const pagination = (
  overrides: Partial<EventPagination> = {},
): EventPagination => ({
  items: [item('a'), item('b')],
  total: undefined,
  hasMore: true,
  isLoadingMore: false,
  isIdle: true,
  hasLoadMoreError: false,
  loadMore,
  ...overrides,
});

const loading = { isLoadingMore: true, isIdle: false };
const paused = { isLoadingMore: false, isIdle: false };
const onePageMore = { items: [item('a'), item('b'), item('c')] };

const search = (initial: EventPagination, matchCount = 0) =>
  renderHook(({ pages, matches }) => useLoadUntilMatch(pages, matches), {
    initialProps: { pages: initial, matches: matchCount },
  });

describe('useLoadUntilMatch', () => {
  beforeEach(() => loadMore.mockReset());
  afterEach(cleanup);

  it('asks for the next page while nothing loaded so far matches', () => {
    const { result } = search(pagination());

    expect(result.current).toBe('searching');
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('waits for a page that is already on its way', () => {
    const { result } = search(pagination(loading));

    expect(result.current).toBe('searching');
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('asks again when a page arrives with still nothing to show', () => {
    const { rerender } = search(pagination());
    rerender({ pages: pagination(loading), matches: 0 });
    rerender({ pages: pagination(onePageMore), matches: 0 });

    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it('asks again when a page lands between two renders', () => {
    const { rerender } = search(pagination());
    rerender({ pages: pagination(onePageMore), matches: 0 });

    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it('asks once for a page, however often the list renders meanwhile', () => {
    const { rerender } = search(pagination());
    rerender({ pages: pagination(), matches: 0 });
    rerender({ pages: pagination(), matches: 0 });

    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('leaves a request paused offline or in a hidden tab to resume, rather than asking again', () => {
    const { result, rerender } = search(pagination());
    rerender({ pages: pagination(loading), matches: 0 });
    rerender({ pages: pagination(paused), matches: 0 });
    rerender({ pages: pagination(paused), matches: 0 });

    expect(result.current).toBe('searching');
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('asks again when a request ends with neither a page nor an error', () => {
    const { rerender } = search(pagination());
    rerender({ pages: pagination(loading), matches: 0 });
    rerender({ pages: pagination(), matches: 0 });

    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it('stops at the first match', () => {
    const { result } = search(pagination(), 1);

    expect(result.current).toBe('matched');
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('stops at the last page, where nothing matching is the answer', () => {
    const { result } = search(pagination({ hasMore: false }));

    expect(result.current).toBe('none');
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('stops after a page fails rather than asking for it again in a loop', () => {
    const { result, rerender } = search(pagination({ hasLoadMoreError: true }));
    rerender({ pages: pagination({ hasLoadMoreError: true }), matches: 0 });

    expect(result.current).toBe('failed');
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('counts a retry on its way as searching, not as failed', () => {
    const { result } = search(
      pagination({ hasLoadMoreError: true, ...loading }),
    );

    expect(result.current).toBe('searching');
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('counts a retry paused in a hidden tab as searching, not as failed', () => {
    const { result } = search(
      pagination({ hasLoadMoreError: true, ...paused }),
    );

    expect(result.current).toBe('searching');
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('carries on after a retry succeeds and still finds nothing', () => {
    const { rerender } = search(pagination({ hasLoadMoreError: true }));
    rerender({ pages: pagination(onePageMore), matches: 0 });

    expect(loadMore).toHaveBeenCalledOnce();
  });
});
