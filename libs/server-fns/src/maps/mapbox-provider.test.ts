import { describe, expect, it } from 'vitest';

import { createMapboxProvider } from './mapbox-provider.js';
import {
  addressFeature,
  cafeFeature,
  cityFeature,
  coffeeRetailerFeature,
  localityFeature,
  location,
  outsideCafeFeature,
  queuedFetcher,
  response,
} from './mapbox-provider.fixtures.js';

describe('MapboxMapProvider', () => {
  it('resolves a bounded city viewport without exposing the token in output', async () => {
    const { fetcher, requests } = queuedFetcher([[cityFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.getCityViewport(location);

    expect(result).toEqual({
      ok: true,
      data: {
        center: { latitude: 36.7538, longitude: 3.0588 },
        bounds: [2.9, 36.6, 3.3, 36.9],
      },
    });
    const request = new URL(requests[0]);
    expect(request.pathname).toBe('/search/searchbox/v1/forward');
    expect(request.searchParams.get('country')).toBe('DZ');
    expect(request.searchParams.get('language')).toBe('en');
    expect(request.searchParams.get('types')).toBe('city,place,locality');
  });

  it('keeps only supported POIs inside the canonical city', async () => {
    const { fetcher } = queuedFetcher([
      [cityFeature],
      [cafeFeature, localityFeature, outsideCafeFeature, coffeeRetailerFeature],
    ]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.searchVenues({
      ...location,
      query: 'café',
    });

    expect(result).toEqual({
      ok: true,
      data: [
        {
          providerId: 'poi-cafe',
          kind: 'poi',
          name: 'Café des Fondateurs',
          address: '12 Rue des Entrepreneurs, Alger',
          latitude: 36.75,
          longitude: 3.06,
        },
      ],
    });
  });

  it('maps malformed provider data to a typed availability error', async () => {
    const provider = createMapboxProvider('test-token', async () =>
      Response.json({ unexpected: true }),
    );

    const result = await provider.getCityViewport(location);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_provider_unavailable');
  });

  it('rejects unordered city bounds as malformed provider data', async () => {
    const provider = createMapboxProvider('test-token', async () =>
      response([{ ...cityFeature, bbox: [3.3, 36.9, 2.9, 36.6] }]),
    );

    const result = await provider.getCityViewport(location);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_provider_unavailable');
  });
});
