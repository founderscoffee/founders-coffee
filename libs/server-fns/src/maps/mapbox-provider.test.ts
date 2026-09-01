import { describe, expect, it } from 'vitest';

import { createMapboxProvider } from './mapbox-provider.js';
import type { MapProviderLocation } from './provider.js';

const location: MapProviderLocation = {
  marketCode: 'DZ',
  city: {
    code: '1',
    name: 'Algiers',
    nameAr: 'الجزائر',
    slug: 'algiers',
    stateCode: '01',
    featured: true,
  },
  locale: 'ar',
};

const cityFeature = {
  type: 'Feature',
  bbox: [2.9, 36.6, 3.3, 36.9],
  geometry: { type: 'Point', coordinates: [3.0588, 36.7538] },
  properties: {
    mapbox_id: 'city-algiers',
    feature_type: 'place',
    name: 'Algiers',
    context: { country: { name: 'Algeria', country_code: 'DZ' } },
  },
};

const cafeFeature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [3.06, 36.75] },
  properties: {
    mapbox_id: 'poi-cafe',
    feature_type: 'poi',
    name: 'Café des Fondateurs',
    full_address: '12 Rue des Entrepreneurs, Alger',
    maki: 'cafe',
    poi_category_ids: ['cafe', 'coffee'],
    context: {
      country: { name: 'Algeria', country_code: 'DZ' },
      place: { name: 'Algiers' },
    },
  },
};

const localityFeature = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [3.05, 36.74] },
  properties: {
    mapbox_id: 'place-algiers',
    feature_type: 'place',
    name: 'Algiers',
    context: {
      country: { name: 'Algeria', country_code: 'DZ' },
      place: { name: 'Algiers' },
    },
  },
};

const outsideCafeFeature = {
  ...cafeFeature,
  geometry: { type: 'Point', coordinates: [-0.63, 35.69] },
  properties: {
    ...cafeFeature.properties,
    mapbox_id: 'poi-oran-cafe',
    name: 'Oran Café',
    context: {
      country: { name: 'Algeria', country_code: 'DZ' },
      place: { name: 'Oran' },
    },
  },
};

const coffeeRetailerFeature = {
  ...cafeFeature,
  properties: {
    ...cafeFeature.properties,
    mapbox_id: 'poi-coffee-retailer',
    name: 'Coffee Equipment Store',
    maki: 'shop',
    poi_category_ids: ['coffee_shop_supplies'],
  },
};

const response = (features: readonly unknown[]): Response =>
  Response.json({ type: 'FeatureCollection', features });

const queuedFetcher = (
  payloads: readonly (readonly unknown[])[],
): { fetcher: (input: string) => Promise<Response>; requests: string[] } => {
  const requests: string[] = [];
  let index = 0;
  return {
    requests,
    fetcher: async (input) => {
      requests.push(input);
      return response(payloads[index++] ?? []);
    },
  };
};

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
    expect(request.searchParams.get('language')).toBe('ar');
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
          name: 'Café des Fondateurs',
          address: '12 Rue des Entrepreneurs, Alger',
          latitude: 36.75,
          longitude: 3.06,
        },
      ],
    });
  });

  it('rejects reverse lookup outside the selected city before venue lookup', async () => {
    const { fetcher, requests } = queuedFetcher([[cityFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 35.69,
      longitude: -0.63,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_outside_city');
    expect(requests).toHaveLength(1);
  });

  it('normalizes a supported reverse result and rejects a locality', async () => {
    const successful = queuedFetcher([[cityFeature], [cafeFeature]]);
    const supportedProvider = createMapboxProvider(
      'test-token',
      successful.fetcher,
    );
    const supported = await supportedProvider.reverseVenue({
      ...location,
      latitude: 36.75,
      longitude: 3.06,
    });
    expect(supported.ok).toBe(true);
    if (supported.ok) expect(supported.data.providerId).toBe('poi-cafe');

    const rejected = queuedFetcher([[cityFeature], [localityFeature]]);
    const rejectedProvider = createMapboxProvider(
      'test-token',
      rejected.fetcher,
    );
    const unsupported = await rejectedProvider.reverseVenue({
      ...location,
      latitude: 36.74,
      longitude: 3.05,
    });
    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok)
      expect(unsupported.error.code).toBe('map_venue_unsupported');
  });

  it('rejects a supported POI that is too far from the selected point', async () => {
    const distantCafe = {
      ...cafeFeature,
      geometry: { type: 'Point', coordinates: [3.1, 36.78] },
    };
    const { fetcher } = queuedFetcher([[cityFeature], [distantCafe]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
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
