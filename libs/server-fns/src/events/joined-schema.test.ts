import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import {
  hostedEventsRequestSchema,
  joinedEventsRequestSchema,
} from './schemas.js';

describe('joinedEventsRequestSchema', () => {
  it('accepts a bare request, because the caller is the session', () => {
    expect(joinedEventsRequestSchema.safeParse({}).success).toBe(true);
  });

  it('refuses a user id, which is the whole point of it', () => {
    const asSomebodyElse = joinedEventsRequestSchema.safeParse({
      userId: id('usr'),
    });

    expect(asSomebodyElse.success).toBe(false);
  });

  it('refuses a host id borrowed from the public schema', () => {
    const hostId = id('usr');

    expect(hostedEventsRequestSchema.safeParse({ hostId }).success).toBe(true);
    expect(joinedEventsRequestSchema.safeParse({ hostId }).success).toBe(false);
  });

  it('takes the paging and market options the hosted one takes', () => {
    expect(
      joinedEventsRequestSchema.safeParse({
        marketCode: 'DZ',
        beforeStartsAt: 1_700_000_000_000,
        beforeId: id('evt'),
        limit: 20,
      }).success,
    ).toBe(true);
  });

  it('bounds the page size, so one request cannot ask for everything', () => {
    expect(joinedEventsRequestSchema.safeParse({ limit: 50 }).success).toBe(
      true,
    );
    expect(joinedEventsRequestSchema.safeParse({ limit: 51 }).success).toBe(
      false,
    );
    expect(joinedEventsRequestSchema.safeParse({ limit: 0 }).success).toBe(
      false,
    );
  });
});

describe('the public hosted schema still takes whose history to fetch', () => {
  it('requires a host id, unlike the owner-only one', () => {
    expect(hostedEventsRequestSchema.safeParse({}).success).toBe(false);
  });

  it('refuses an empty host id rather than listing everybody', () => {
    expect(hostedEventsRequestSchema.safeParse({ hostId: '' }).success).toBe(
      false,
    );
  });
});
