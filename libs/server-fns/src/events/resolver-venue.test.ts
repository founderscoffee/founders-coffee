import { describe, expect, it, vi } from 'vitest';

import { ok } from '@founders-coffee/core';
import { venues as venuesDomain } from '@founders-coffee/domain';

import type { MapProvider } from '../maps/provider.js';
import { createEventResolver } from './resolver.js';
import {
  createInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

const ALGIERS = { marketCode: 'DZ', cityCode: '556' };

const snapshotVenue = () => {
  const venue = venuesDomain
    .getCityVenues(ALGIERS.marketCode, ALGIERS.cityCode)
    .find((candidate) => candidate.eligible);
  expect(
    venue,
    'Algiers snapshot must ship at least one eligible venue',
  ).toBeDefined();
  return venue!;
};

describe('createEventResolver venue verification', () => {
  it('publishes a snapshot venue without asking the map provider', async () => {
    const db = await setupDb();
    const venue = snapshotVenue();
    const reverseVenue = vi.fn(testMapProvider.reverseVenue);
    const provider = { ...testMapProvider, reverseVenue } satisfies MapProvider;

    const result = await createEventResolver(
      db,
      provider,
      TEST_HOST_ID,
      createInput({
        cityCode: ALGIERS.cityCode,
        venueProviderId: venue.providerId,
        venueName: venue.name,
        venueAddress: venue.address || 'Algiers',
        latitude: venue.latitude,
        longitude: venue.longitude,
        title: 'Snapshot venue event',
      }),
    );

    expect(result.ok).toBe(true);
    expect(reverseVenue).not.toHaveBeenCalled();
  });

  it('keeps the snapshot name and address instead of the provider reading', async () => {
    const db = await setupDb();
    const venue = snapshotVenue();
    const provider = {
      ...testMapProvider,
      reverseVenue: async () =>
        ok({
          providerId: 'provider-would-say',
          kind: 'address' as const,
          name: 'Some Street',
          address: 'A bare street the provider found',
          latitude: 0,
          longitude: 0,
        }),
    } satisfies MapProvider;

    const result = await createEventResolver(
      db,
      provider,
      TEST_HOST_ID,
      createInput({
        cityCode: ALGIERS.cityCode,
        venueProviderId: venue.providerId,
        venueName: venue.name,
        venueAddress: venue.address || 'Algiers',
        latitude: venue.latitude,
        longitude: venue.longitude,
        title: 'Snapshot venue kept',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.venue).toBe(venue.name);
    expect(result.data.venueAddress).toBe(venue.address);
    expect(result.data.latitude).toBeCloseTo(venue.latitude, 5);
  });

  it('still verifies a point the host dropped on the map', async () => {
    const db = await setupDb();
    const reverseVenue = vi.fn(testMapProvider.reverseVenue);
    const provider = { ...testMapProvider, reverseVenue } satisfies MapProvider;

    const result = await createEventResolver(
      db,
      provider,
      TEST_HOST_ID,
      createInput({ title: 'Map click event' }),
    );

    expect(result.ok).toBe(true);
    expect(reverseVenue).toHaveBeenCalledOnce();
  });

  it('falls back to the provider when a borrowed id points somewhere else', async () => {
    const db = await setupDb();
    const venue = snapshotVenue();
    const reverseVenue = vi.fn(testMapProvider.reverseVenue);
    const provider = { ...testMapProvider, reverseVenue } satisfies MapProvider;

    const result = await createEventResolver(
      db,
      provider,
      TEST_HOST_ID,
      createInput({
        cityCode: ALGIERS.cityCode,
        venueProviderId: venue.providerId,
        latitude: venue.latitude + 0.01,
        longitude: venue.longitude + 0.01,
        title: 'Borrowed id event',
      }),
    );

    expect(result.ok).toBe(true);
    expect(reverseVenue).toHaveBeenCalledOnce();
  });
});
