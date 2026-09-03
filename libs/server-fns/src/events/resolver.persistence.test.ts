import { describe, expect, it } from 'vitest';

import { AppError, err, ok } from '@founders-coffee/core';
import { countEventsByStatus, createEvent } from '@founders-coffee/db';

import type { MapProvider } from '../maps/provider.js';
import {
  createEventResolver,
  createEventResolverWithId,
  eventSlugCandidates,
} from './resolver.js';
import {
  baseEvent,
  createInput,
  nextId,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

describe('createEventResolver persistence (real D1)', () => {
  it('derives state ownership and persists the complete shared command', async () => {
    const db = await setupDb();

    const result = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        hostId: TEST_HOST_ID,
        marketCode: 'DZ',
        stateCode: '01',
        cityCode: '1',
        title: 'Resolver creation event',
        venue: 'Café des Délices',
        venueAddress: '12 Rue des Entrepreneurs, Alger',
        latitude: 36.7538,
        longitude: 3.0588,
        capacity: 24,
        language: 'fr',
        category: 'coffee-meetup',
        isFree: true,
        status: 'published',
        rsvps: 0,
      });
      expect(result.data.id).toMatch(/^evt_[0-9a-f]{32}$/);
      expect(result.data.slug).toBe('resolver-creation-event');
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.updatedAt).toBeInstanceOf(Date);
      expect(result.data.endsAt?.toISOString()).toBe(
        '2099-01-15T19:00:00.000Z',
      );
    }
  });

  it('rejects an unsupported venue before writing to D1', async () => {
    const db = await setupDb();
    const before = await countEventsByStatus(db, 'published');
    const rejectingMapProvider: MapProvider = {
      ...testMapProvider,
      reverseVenue: async () =>
        err(new AppError('map_venue_unsupported', 'Select a supported venue')),
    };

    const result = await createEventResolver(
      db,
      rejectingMapProvider,
      TEST_HOST_ID,
      createInput({ title: 'Rejected venue event' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
    expect(await countEventsByStatus(db, 'published')).toBe(before);
  });

  it('names an address fallback from the host while keeping the verified location', async () => {
    const db = await setupDb();
    const addressOnlyProvider: MapProvider = {
      ...testMapProvider,
      reverseVenue: async () =>
        ok({
          providerId: 'address-yousfi',
          kind: 'address' as const,
          name: '15 Rue Yousfi Mohamed',
          address: '15 Rue Yousfi Mohamed, Alger',
          latitude: 36.7501,
          longitude: 3.0601,
        }),
    };

    const result = await createEventResolver(
      db,
      addressOnlyProvider,
      TEST_HOST_ID,
      createInput({
        title: 'Address fallback event',
        venueName: 'Café des Délices',
        venueAddress: 'Untrusted address',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        venue: 'Café des Délices',
        venueAddress: '15 Rue Yousfi Mohamed, Alger',
        latitude: 36.7501,
        longitude: 3.0601,
      });
    }
  });

  it('persists the provider-verified venue instead of client-owned venue text', async () => {
    const db = await setupDb();
    const verifiedMapProvider: MapProvider = {
      ...testMapProvider,
      reverseVenue: async () =>
        ok({
          providerId: 'verified-venue',
          kind: 'poi' as const,
          name: 'Verified Coworking Space',
          address: '8 Verified Street, Algiers',
          latitude: 36.754,
          longitude: 3.059,
        }),
    };

    const result = await createEventResolver(
      db,
      verifiedMapProvider,
      TEST_HOST_ID,
      createInput({
        title: 'Canonical venue event',
        venueName: 'Untrusted venue',
        venueAddress: 'Untrusted address',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        venue: 'Verified Coworking Space',
        venueAddress: '8 Verified Street, Algiers',
        latitude: 36.754,
        longitude: 3.059,
      });
    }
  });

  it('reserves distinct routes for concurrent same-title creation', async () => {
    const db = await setupDb();
    const input = createInput({ title: 'Concurrent route reservation' });

    const results = await Promise.all([
      createEventResolver(db, testMapProvider, TEST_HOST_ID, input),
      createEventResolver(db, testMapProvider, TEST_HOST_ID, input),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const slugs = results.flatMap((result) =>
      result.ok ? [result.data.slug] : [],
    );
    expect(new Set(slugs).size).toBe(2);
    expect(slugs).toContain('concurrent-route-reservation');
  });

  it('returns a typed error when every bounded route candidate conflicts', async () => {
    const db = await setupDb();
    const eventId = 'evt_000000000000000000000000collision';
    const title = 'Exhausted route candidates';
    const [baseSlug, suffixedSlug] = eventSlugCandidates(title, eventId);
    await createEvent(db, baseEvent(nextId(), baseSlug));
    await createEvent(db, baseEvent(nextId(), suffixedSlug));

    const result = await createEventResolverWithId(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({ title }),
      eventId,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_route_conflict');
  });
});
