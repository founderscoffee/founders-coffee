import { describe, expect, it } from 'vitest';

import { createMapboxProvider } from './mapbox-provider.js';
import {
  addressFeature,
  cafeFeature,
  cityFeature,
  location,
  queuedFetcher,
} from './mapbox-provider.fixtures.js';

describe('the address a venue is offered under', () => {
  it('does not repeat a venue name inside its own address', async () => {
    const unaddressedCafe = {
      ...cafeFeature,
      properties: {
        ...cafeFeature.properties,
        mapbox_id: 'poi-cafe-no-address',
        full_address: undefined,
        place_formatted: 'Kouinine, El Oued, Alger',
      },
    };
    const { fetcher } = queuedFetcher([[cityFeature], [unaddressedCafe]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.searchVenues({ ...location, query: 'café' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data[0]?.address,
      'the row shows the name on one line and the address on the next, so an address that opens with the name reads it out twice, and a screen reader has no font size to tell the two lines apart by',
    ).toBe('Kouinine, El Oued, Alger');
  });

  it('keeps a street name in its own address, which is all it has', async () => {
    const unaddressedStreet = {
      ...addressFeature,
      properties: {
        ...addressFeature.properties,
        mapbox_id: 'address-no-full',
        full_address: undefined,
        place_formatted: 'Alger, Algeria',
      },
    };
    const { fetcher } = queuedFetcher([[cityFeature], [unaddressedStreet]]);
    const provider = createMapboxProvider('test-token', fetcher);

    const result = await provider.searchVenues({ ...location, query: 'rue' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data[0]?.address,
      'a street is named by its name, so dropping it leaves Alger, Algeria as the whole address and the host cannot tell which street they picked',
    ).toBe('15 Rue Yousfi Mohamed, Alger, Algeria');
  });
});
