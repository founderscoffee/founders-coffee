import { describe, expect, it } from 'vitest';

import { AppError, err, ok } from '@founders-coffee/core';

import type { MapProvider } from './provider.js';
import {
  getHostMapContextResolver,
  reverseEventVenueResolver,
  searchEventVenuesResolver,
} from './resolver.js';

const provider = {
  name: 'test-map',
  getCityViewport: async () =>
    ok({
      center: { latitude: 36.7538, longitude: 3.0588 },
      bounds: [2.9, 36.6, 3.3, 36.9] as const,
    }),
  searchVenues: async ({ query }) =>
    ok([
      {
        providerId: `venue-${query}`,
        name: 'Test Café',
        address: 'Algiers',
        latitude: 36.7538,
        longitude: 3.0588,
      },
    ]),
  reverseVenue: async ({ latitude, longitude }) =>
    ok({
      providerId: 'venue-reverse',
      name: 'Test Café',
      address: 'Algiers',
      latitude,
      longitude,
    }),
} satisfies MapProvider;

const location = {
  marketCode: 'DZ',
  cityCode: '1',
  locale: 'en' as const,
};

describe('map resolvers', () => {
  it('resolves canonical geography before each provider operation', async () => {
    const viewport = await getHostMapContextResolver(provider, location);
    const search = await searchEventVenuesResolver(provider, {
      ...location,
      query: 'café',
    });
    const reverse = await reverseEventVenueResolver(provider, {
      ...location,
      latitude: 36.7538,
      longitude: 3.0588,
    });

    expect(viewport.ok).toBe(true);
    expect(search.ok).toBe(true);
    expect(reverse.ok).toBe(true);
  });

  it('rejects an unknown city without calling the provider', async () => {
    let calls = 0;
    const countingProvider: MapProvider = {
      ...provider,
      getCityViewport: async (input) => {
        calls += 1;
        return provider.getCityViewport(input);
      },
    };

    const result = await getHostMapContextResolver(countingProvider, {
      ...location,
      cityCode: 'unknown',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_city_not_found');
    expect(calls).toBe(0);
  });

  it('preserves stable provider error codes', async () => {
    const failingProvider: MapProvider = {
      ...provider,
      reverseVenue: async () =>
        err(new AppError('map_venue_unsupported', 'Unsupported venue')),
    };

    const result = await reverseEventVenueResolver(failingProvider, {
      ...location,
      latitude: 36.7538,
      longitude: 3.0588,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
  });
});
