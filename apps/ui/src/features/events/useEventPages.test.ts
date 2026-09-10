import { describe, expect, it, vi } from 'vitest';

import type { EventFeedItem } from './api';
import { useEventPages } from './useEventPages';

const item = (id: string) => ({ id }) as unknown as EventFeedItem;

const query = (overrides: Record<string, unknown> = {}) =>
  ({
    data: undefined,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  }) as never;

describe('useEventPages', () => {
  it('shows the server-rendered page until the query has one of its own', () => {
    const seed = [item('a'), item('b')];

    expect(useEventPages(query(), seed).items).toEqual(seed);
  });

  it('drops the seed as soon as real pages arrive, even an empty one', () => {
    const pages = { pages: [{ items: [] }] };

    expect(useEventPages(query({ data: pages }), [item('a')]).items).toEqual(
      [],
    );
  });

  it('flattens every page in order', () => {
    const pages = {
      pages: [{ items: [item('a')] }, { items: [item('b'), item('c')] }],
    };

    expect(
      useEventPages(query({ data: pages })).items.map((row) => row.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('reports the aggregate total, not the number of rows fetched', () => {
    const pages = { pages: [{ items: [item('a')], total: 30 }] };

    const result = useEventPages(query({ data: pages }));
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(30);
  });

  it('has no total when no page carries one', () => {
    const pages = { pages: [{ items: [item('a')] }] };

    expect(useEventPages(query({ data: pages })).total).toBeUndefined();
  });

  it('passes the loading and more-available state straight through', () => {
    const fetchNextPage = vi.fn();
    const result = useEventPages(
      query({ hasNextPage: true, isFetchingNextPage: true, fetchNextPage }),
    );

    expect(result.hasMore).toBe(true);
    expect(result.isLoadingMore).toBe(true);
    result.loadMore();
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });
});
