import { describe, expect, it } from 'vitest';

import { createMapboxProvider } from './mapbox-provider.js';
import {
  addressFeature,
  cafeFeature,
  cityFeature,
  localityFeature,
  outsideCafeFeature,
  location,
  queuedFetcher,
} from './mapbox-provider.fixtures.js';

describe('MapboxMapProvider venue resolution', () => {
  it('normalizes a supported reverse result and rejects a locality', async () => {
    const successful = queuedFetcher([[cafeFeature]]);
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

    const rejected = queuedFetcher([[localityFeature]]);
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
    const { fetcher } = queuedFetcher([[distantCafe]]);
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
    const { fetcher } = queuedFetcher([[addressFeature, cafeFeature]]);
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
    const { fetcher } = queuedFetcher([[addressFeature]]);
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
    const { fetcher } = queuedFetcher([[localityFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 36.74,
      longitude: 3.05,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
  });

  it('offers a distant address as a bare address for the host to name', async () => {
    const farAddress = {
      ...addressFeature,
      geometry: { type: 'Point', coordinates: [-0.63, 35.69] },
    };
    const { fetcher } = queuedFetcher([[farAddress]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.kind).toBe('address');
  });

  it('rejects a pin with nothing addressable anywhere in the response', async () => {
    const { fetcher } = queuedFetcher([[localityFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
  });

  it('resolves the city in a stable language, whatever the host is reading', async () => {
    const { fetcher, requests } = queuedFetcher([[cityFeature], []]);
    const provider = createMapboxProvider('test-token', fetcher);

    await provider.getCityViewport({ ...location, locale: 'fr' });

    expect(new URL(requests[0]).searchParams.get('language')).toBe('en');
  });

  it('accepts a venue the provider localizes under a different city name', async () => {
    const frenchAddress = {
      ...addressFeature,
      properties: {
        ...addressFeature.properties,
        context: {
          country: { name: 'Algérie', country_code: 'DZ' },
          place: { name: 'Alger' },
        },
      },
    };
    const { fetcher } = queuedFetcher([[frenchAddress]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.reverseVenue({
      ...location,
      locale: 'fr',
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.providerId).toBe('address-yousfi');
  });
});

describe('MapboxMapProvider describePoint', () => {
  it('returns a storable address and the administrative hierarchy', async () => {
    const { fetcher, requests } = queuedFetcher([[addressFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.describePoint({
      marketCode: 'DZ',
      locale: 'ar',
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.address).toBeTruthy();
      expect(result.data.admin?.placeName).toBe('Algiers');
    }
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('permanent=true');
    expect(requests[0]).toContain('geocode/v6/reverse');
  });

  it('refuses to describe a point in another country', async () => {
    const { fetcher } = queuedFetcher([[outsideCafeFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.describePoint({
      marketCode: 'EG',
      locale: 'en',
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
  });

  it('maps a provider outage to a stable error', async () => {
    const provider = createMapboxProvider('test-token', async () => {
      throw new Error('socket hang up');
    });

    const result = await provider.describePoint({
      marketCode: 'DZ',
      locale: 'en',
      latitude: 36.75,
      longitude: 3.06,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_provider_unavailable');
  });
});
