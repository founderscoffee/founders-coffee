import { describe, expect, it } from 'vitest';

import { geo, venues } from '@founders-coffee/domain';

import { createMapboxProvider } from './mapbox-provider.js';
import { cafeFeature, queuedFetcher } from './mapbox-provider.fixtures.js';
import type { MapProviderLocation } from './provider.js';
import { getHostMapContextResolver } from './resolver.js';

const KSAR_EL_BOUKHARI = '929';
const MEDEA_STATE = '26';

const ksarElBoukhari = (): MapProviderLocation => {
  const city = geo.findCity('DZ', KSAR_EL_BOUKHARI);
  if (!city) throw new Error('the DZ geography lost Ksar El Boukhari');
  return { marketCode: 'DZ', city, locale: 'ar' };
};

const place = (
  name: string,
  isoRegion: string,
  coordinates: readonly [number, number] = [2.749532, 35.886467],
) => ({
  type: 'Feature',
  bbox: [
    coordinates[0] - 0.05,
    coordinates[1] - 0.05,
    coordinates[0] + 0.05,
    coordinates[1] + 0.05,
  ],
  geometry: { type: 'Point', coordinates },
  properties: {
    mapbox_id: `place-${name}`,
    feature_type: 'place',
    name,
    context: {
      country: { name: 'Algeria', country_code: 'DZ' },
      region: { region_code_full: isoRegion },
    },
  },
});

const viewportOf = async (features: readonly unknown[]) => {
  const { fetcher } = queuedFetcher([features]);
  return createMapboxProvider('test-token', fetcher).getCityViewport(
    ksarElBoukhari(),
  );
};

describe('where the map opens for a town the provider spells its own way', () => {
  it('finds Ksar El Boukhari under the name Mapbox gives it, Ksar Boukhari', async () => {
    const result = await viewportOf([place('Ksar Boukhari', 'DZ-26')]);

    expect(
      result,
      'the article is the only difference, and it left the host wizard with no map at all in this town (#120)',
    ).toMatchObject({
      ok: true,
      data: { center: { latitude: 35.886467, longitude: 2.749532 } },
    });
  });

  it('refuses a place of another name, even in the town’s own wilaya', async () => {
    const result = await viewportOf([place('Boughari', 'DZ-26')]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_city_not_found');
  });

  it('opens the wizard on the wilaya when Mapbox names another town', async () => {
    const { fetcher } = queuedFetcher([[place('Boughari', 'DZ-26')]]);

    const result = await getHostMapContextResolver(
      createMapboxProvider('test-token', fetcher),
      { marketCode: 'DZ', cityCode: KSAR_EL_BOUKHARI, locale: 'ar' },
    );

    expect(
      result,
      'a town Mapbox does not name as ours opens on its wilaya, never on a town the host did not ask for',
    ).toEqual({ ok: true, data: venues.getStateViewport('DZ', MEDEA_STATE) });
  });

  it('prefers a place named like the town over another in its wilaya', async () => {
    const result = await viewportOf([
      place('Médéa', 'DZ-26', [2.75, 36.27]),
      place('Ksar Boukhari', 'DZ-26'),
    ]);

    expect(result).toMatchObject({
      ok: true,
      data: { center: { latitude: 35.886467, longitude: 2.749532 } },
    });
  });

  it('refuses a place of another name in another wilaya', async () => {
    const result = await viewportOf([place('Boghni', 'DZ-15', [3.95, 36.54])]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_city_not_found');
  });

  it('searches the whole market when the provider cannot place the town', async () => {
    const { fetcher, requests } = queuedFetcher([[], [cafeFeature]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.searchVenues({
      ...ksarElBoukhari(),
      query: 'café',
    });

    expect(
      result,
      'a town the provider cannot place is still a real town, and failing the search there left its hosts with nothing to pick',
    ).toMatchObject({ ok: true, data: [{ providerId: 'poi-cafe' }] });
    const search = new URL(requests[1] ?? '');
    expect(search.searchParams.get('bbox')).toBeNull();
    expect(search.searchParams.get('country')).toBe('DZ');
  });
});
