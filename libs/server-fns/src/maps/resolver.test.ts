import { beforeEach, describe, expect, it } from 'vitest';

import { AppError, err, ok } from '@founders-coffee/core';
import { venues as venuesDomain } from '@founders-coffee/domain';
import { setLogger, type LogEntry } from '@founders-coffee/observability';
import { createServerLogger } from '@founders-coffee/observability/server';

import { testMapProvider } from '../events/resolver.fixtures.js';
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
        kind: 'poi' as const,
        name: 'Test Café',
        address: 'Algiers',
        latitude: 36.7538,
        longitude: 3.0588,
      },
    ]),
  reverseVenue: async ({ latitude, longitude }) =>
    ok({
      providerId: 'venue-reverse',
      kind: 'poi' as const,
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
        err(new AppError('map_venue_not_found', 'Unsupported venue')),
    };

    const result = await reverseEventVenueResolver(failingProvider, {
      ...location,
      latitude: 36.7538,
      longitude: 3.0588,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_not_found');
  });

  const unplaced: MapProvider = {
    ...provider,
    getCityViewport: async () =>
      err(
        new AppError('map_city_not_found', 'Map provider could not place it'),
      ),
  };

  it('opens on the town’s wilaya when the provider cannot place a town we know', async () => {
    const KSAR_EL_BOUKHARI = '929';
    const MEDEA_STATE = '26';
    expect(
      venuesDomain.getCityViewportSnapshot('DZ', KSAR_EL_BOUKHARI),
      'a town in the snapshot never asks the provider, so it cannot test this',
    ).toBeNull();

    const result = await getHostMapContextResolver(unplaced, {
      ...location,
      cityCode: KSAR_EL_BOUKHARI,
    });

    expect(
      result,
      'the pin the host drops decides the city anyway; refusing the map left the step with no way forward (#120)',
    ).toEqual({
      ok: true,
      data: venuesDomain.getStateViewport('DZ', MEDEA_STATE),
    });
  });

  it('still reports a provider that is down rather than opening somewhere else', async () => {
    const down: MapProvider = {
      ...provider,
      getCityViewport: async () =>
        err(new AppError('map_provider_unavailable', 'Map provider is down')),
    };

    const result = await getHostMapContextResolver(down, {
      ...location,
      cityCode: '929',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_provider_unavailable');
  });

  const CONSTANTINE = '891';

  const arabicVenue = () => {
    const found = venuesDomain
      .getCityVenues('DZ', CONSTANTINE)
      .find((venue) => venue.eligible && /[\u0600-\u06FF]/u.test(venue.name));
    if (!found)
      throw new Error('the DZ snapshot carries no Arabic venue to search for');
    return found;
  };

  it('answers an Arabic query from the venues the market ships with', async () => {
    const venue = arabicVenue();

    const result = await searchEventVenuesResolver(provider, {
      ...location,
      cityCode: CONSTANTINE,
      locale: 'ar',
      query: venue.name,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.map((candidate) => candidate.name),
      'the provider indexes almost no cafes in Algeria under Arabic names, and this market ships hundreds that it does not; a query typed in the language the product is written in found none of them',
    ).toContain(venue.name);
  });

  it('puts what it already knows ahead of what it has to ask for', async () => {
    const venue = arabicVenue();

    const result = await searchEventVenuesResolver(provider, {
      ...location,
      cityCode: CONSTANTINE,
      locale: 'ar',
      query: venue.name,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.providerId).toBe(venue.providerId);
  });

  it('still answers from the snapshot when the provider is down', async () => {
    const venue = arabicVenue();
    const failing: MapProvider = {
      ...provider,
      searchVenues: async () => err(new AppError('map_unavailable', 'down')),
    };

    const result = await searchEventVenuesResolver(failing, {
      ...location,
      cityCode: CONSTANTINE,
      locale: 'ar',
      query: venue.name,
    });

    expect(
      result.ok,
      'a reader searching for a cafe this market already knows about should not be told the map is unavailable',
    ).toBe(true);
  });
});

describe('provider failure logging', () => {
  const entries: LogEntry[] = [];

  beforeEach(() => {
    entries.length = 0;
    setLogger(
      createServerLogger({
        level: 'debug',
        transport: (entry) => {
          entries.push(entry);
        },
      }),
    );
  });

  const reverseFailingWith = (error: AppError) =>
    reverseEventVenueResolver(
      { ...testMapProvider, reverseVenue: async () => err(error) },
      { ...location, latitude: 36.7538, longitude: 3.0588 },
    );

  it('logs a point the provider has nothing for at info, beside the routine not-founds', async () => {
    await reverseFailingWith(
      new AppError(
        'map_venue_not_found',
        'No address could be resolved near this point',
      ),
    );

    expect(entries).toEqual([
      expect.objectContaining({
        level: 'info',
        msg: 'map_provider_operation_failed',
        operation: 'venue_reverse',
        errorCode: 'map_venue_not_found',
      }),
    ]);
  });

  it('keeps a provider that is down at warn', async () => {
    await reverseFailingWith(
      new AppError('map_provider_unavailable', 'Map provider request failed'),
    );

    expect(entries).toEqual([
      expect.objectContaining({
        level: 'warn',
        msg: 'map_provider_operation_failed',
        operation: 'venue_reverse',
        errorCode: 'map_provider_unavailable',
      }),
    ]);
  });
});
