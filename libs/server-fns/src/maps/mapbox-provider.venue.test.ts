import { describe, expect, it } from 'vitest';

import { createMapboxProvider } from './mapbox-provider.js';
import {
  addressFeature,
  cafeFeature,
  cityFeature,
  localityFeature,
  location,
  queuedFetcher,
} from './mapbox-provider.fixtures.js';

describe('MapboxMapProvider venue resolution', () => {
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

  it('asks the provider for addresses as well as points of interest', async () => {
    const { fetcher, requests } = queuedFetcher([[cityFeature], []]);
    const provider = createMapboxProvider('test-token', fetcher);

    await provider.searchVenues({ ...location, query: 'café' });

    expect(new URL(requests[1]).searchParams.get('types')).toBe(
      'poi,address,street',
    );
  });

  it('ranks supported venues above bare addresses in search', async () => {
    const { fetcher } = queuedFetcher([
      [cityFeature],
      [addressFeature, cafeFeature],
    ]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.searchVenues({ ...location, query: 'café' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((venue) => [venue.providerId, venue.kind])).toEqual([
      ['poi-cafe', 'poi'],
      ['address-yousfi', 'address'],
    ]);
  });

  it('prefers a nearby venue over an address at the same point', async () => {
    const { fetcher } = queuedFetcher([
      [cityFeature],
      [addressFeature, cafeFeature],
    ]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.providerId).toBe('poi-cafe');
      expect(result.data.kind).toBe('poi');
    }
  });

  it('falls back to a verified address where the provider indexes no venue', async () => {
    const { fetcher } = queuedFetcher([[cityFeature], [addressFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        providerId: 'address-yousfi',
        kind: 'address',
        address: '15 Rue Yousfi Mohamed, Alger',
        latitude: 36.7501,
        longitude: 3.0601,
      });
    }
  });

  it('never accepts a city or locality as a venue, even as a fallback', async () => {
    const { fetcher } = queuedFetcher([[cityFeature], [localityFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 36.74,
      longitude: 3.05,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
  });

  it('rejects an address outside the selected city', async () => {
    const foreignAddress = {
      ...addressFeature,
      properties: {
        ...addressFeature.properties,
        context: {
          country: { name: 'Algeria', country_code: 'DZ' },
          place: { name: 'Oran' },
        },
      },
    };
    const { fetcher } = queuedFetcher([[cityFeature], [foreignAddress]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
  });
});
