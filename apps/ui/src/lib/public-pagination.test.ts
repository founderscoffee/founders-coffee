import { describe, expect, it } from 'vitest';

import {
  cursorPairOnly,
  hostedPaginationQuery,
  hostedPaginationSearch,
  hostedPaginationSearchSchema,
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

  it('rejects a cursor that is not merely incomplete but malformed', () => {
    expect(() =>
      publicPaginationSearchSchema.parse({ afterStartsAt: 'bad', afterId: '' }),
    ).toThrow();
  });

  it('erases an unpaired cursor once the router merges it over the raw search', () => {
    for (const raw of [{ afterId: 'evt_123' }, { afterStartsAt: 42 }]) {
      const merged: Record<string, unknown> = {
        ...raw,
        ...publicPaginationSearchSchema.parse(raw),
      };

      expect(
        merged.afterId,
        'the router merges a validator result over the raw search, so a result of {} strips nothing and half a cursor reaches a server function that rejects it with a 500',
      ).toBeUndefined();
      expect(merged.afterStartsAt).toBeUndefined();
    }
  });

  it('erases an unpaired hosted cursor the same way', () => {
    const raw = { beforeId: 'evt_123' };
    const merged = { ...raw, ...hostedPaginationSearchSchema.parse(raw) };

    expect(merged.beforeId).toBeUndefined();
  });

  it('forwards a complete cursor to the server function untouched', () => {
    const paired = { afterStartsAt: 1_725_000_000_000, afterId: 'evt_123' };

    expect(cursorPairOnly(paired)).toEqual(paired);
  });

  it('refuses to forward half a cursor to a server function that demands both', () => {
    expect(
      cursorPairOnly({ afterStartsAt: undefined, afterId: 'evt_123' }).afterId,
      'landingPaginationSchema rejects a half cursor, so forwarding one is a 500',
    ).toBeUndefined();
    expect(
      cursorPairOnly({ afterStartsAt: 42, afterId: undefined }).afterStartsAt,
    ).toBeUndefined();
  });
});
