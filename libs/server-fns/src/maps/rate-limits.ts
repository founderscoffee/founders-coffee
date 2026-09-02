export interface RateLimitPolicy {
  readonly action: string;
  readonly limit: number;
  readonly windowMs: number;
}

const TEN_MINUTES_MS = 600_000;

export const MAP_RATE_LIMITS = {
  hostMapContext: {
    action: 'map_context',
    limit: 20,
    windowMs: TEN_MINUTES_MS,
  },
  venueSearch: {
    action: 'venue_search',
    limit: 60,
    windowMs: TEN_MINUTES_MS,
  },
  venueReverse: {
    action: 'venue_reverse',
    limit: 30,
    windowMs: TEN_MINUTES_MS,
  },
} as const satisfies Record<string, RateLimitPolicy>;
