import { describe, expect, it } from 'vitest';

import {
  hostedPaginationQuery,
  hostedPaginationSearch,
  paginationQuery,
  paginationSearch,
  publicPaginationSearchSchema,
} from './public-pagination';

describe('public pagination', () => {
  it('serializes a feed cursor for a crawlable next page', () => {
    const cursor = { startsAt: 1_725_000_000_000, id: 'evt_123' };

    expect(paginationSearch(cursor)).toEqual({
      afterStartsAt: cursor.startsAt,
      afterId: cursor.id,
    });
    expect(paginationQuery(cursor)).toBe(
      'afterStartsAt=1725000000000&afterId=evt_123',
    );
  });

  it('serializes a hosted-history cursor in reverse chronological order', () => {
    const cursor = { startsAt: 1_725_000_000_000, id: 'evt_123' };

    expect(hostedPaginationSearch(cursor)).toEqual({
      beforeStartsAt: cursor.startsAt,
      beforeId: cursor.id,
    });
    expect(hostedPaginationQuery(cursor)).toBe(
      'beforeStartsAt=1725000000000&beforeId=evt_123',
    );
  });

  it('drops incomplete or invalid public cursors', () => {
    expect(publicPaginationSearchSchema.parse({ afterStartsAt: 42 })).toEqual(
      {},
    );
    expect(publicPaginationSearchSchema.parse({ afterId: 'evt_123' })).toEqual(
      {},
    );
    expect(() =>
      publicPaginationSearchSchema.parse({ afterStartsAt: 'bad', afterId: '' }),
    ).toThrow();
  });
});
