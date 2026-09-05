import { describe, expect, it, vi } from 'vitest';

import { ok, err, AppError } from '@founders-coffee/core';

import { venues } from '@founders-coffee/domain';

import { testMapProvider } from '../events/resolver.fixtures.js';
import { locatePoint } from './locate.js';
import type { MapProvider } from './provider.js';

const ALGIERS = { latitude: 36.7538, longitude: 3.0588 };

const providerWith = (
  describePoint: MapProvider['describePoint'],
): MapProvider => ({ ...testMapProvider, describePoint });

describe('locatePoint', () => {
  it('resolves the state from the ISO region the provider reports', async () => {
    const result = await locatePoint(testMapProvider, {
      marketCode: 'DZ',
      locale: 'en',
      ...ALGIERS,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.stateCode).toBe('16');
      expect(result.data.address).toBe('12 Rue des Entrepreneurs, Alger');
    }
  });

  it('never calls the provider for a venue from our own snapshot', async () => {
    const describePoint = vi.fn(testMapProvider.describePoint);
    const venue = venues.getCityVenues('DZ', '556')[0];
    expect(venue).toBeDefined();

    const result = await locatePoint(providerWith(describePoint), {
      marketCode: 'DZ',
      locale: 'en',
      latitude: venue.latitude,
      longitude: venue.longitude,
      snapshotProviderId: venue.providerId,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.address).toBe(venue.address);
    expect(describePoint).not.toHaveBeenCalled();
  });

  it('refuses to invent a state when the region is unmappable', async () => {
    const result = await locatePoint(
      providerWith(async () =>
        ok({ address: 'Somewhere', admin: { isoRegionCode: 'DZ-99' } }),
      ),
      { marketCode: 'DZ', locale: 'en', ...ALGIERS },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
  });

  it('refuses to invent a state when the provider reports no region', async () => {
    const result = await locatePoint(
      providerWith(async () => ok({ address: 'Somewhere' })),
      { marketCode: 'DZ', locale: 'en', ...ALGIERS },
    );

    expect(result.ok).toBe(false);
  });

  it('propagates a provider failure rather than guessing', async () => {
    const result = await locatePoint(
      providerWith(async () =>
        err(new AppError('map_provider_unavailable', 'down')),
      ),
      { marketCode: 'DZ', locale: 'en', ...ALGIERS },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_provider_unavailable');
  });

  it('falls back to the nearest snapshotted city when no place name matches', async () => {
    const result = await locatePoint(
      providerWith(async () =>
        ok({
          address: 'A street in Algiers',
          admin: { isoRegionCode: 'DZ-16', placeName: 'Nowhere At All' },
        }),
      ),
      { marketCode: 'DZ', locale: 'en', ...ALGIERS },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.stateCode).toBe('16');
  });
});
