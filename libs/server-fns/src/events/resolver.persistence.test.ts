import { describe, expect, it } from 'vitest';

import { AppError, err, ok } from '@founders-coffee/core';
import {
  countEventsByStatus,
  getEvent,
  getRsvpForUser,
} from '@founders-coffee/db';

import type { MapProvider } from '../maps/provider.js';
import { createEventResolver } from './resolver.js';
import {
  createInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

describe('createEventResolver persistence (real D1)', () => {
  it('counts the host as an attendee of their own event', async () => {
    const db = await setupDb();

    const result = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({ title: 'Host attends their own table' }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await getEvent(db, result.data.id);
    const rsvp = await getRsvpForUser(db, {
      eventId: result.data.id,
      userId: TEST_HOST_ID,
    });

    expect(rsvp?.status).toBe('going');
    expect(stored?.rsvps).toBe(1);
  });

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
        language: 'fr',
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
      describePoint: async () =>
        err(new AppError('map_venue_unsupported', 'Nothing here to describe')),
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

  it('keeps the host-authored venue name and the point the host chose', async () => {
    const db = await setupDb();

    const result = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({
        title: 'Address fallback event',
        venueName: 'Café des Délices',
        venueAddress: 'Untrusted address',
        latitude: 36.7501,
        longitude: 3.0601,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        venue: 'Café des Délices',
        latitude: 36.7501,
        longitude: 3.0601,
      });
    }
  });

  it('derives the city and state from the point, not from the client', async () => {
    const db = await setupDb();
    const elsewhereProvider: MapProvider = {
      ...testMapProvider,
      describePoint: async () =>
        ok({
          address: '5 Boulevard Emir Abdelkader, Oran',
          admin: {
            isoRegionCode: 'DZ-31',
            regionName: 'Oran',
            placeName: 'Oran',
          },
        }),
    };

    const result = await createEventResolver(
      db,
      elsewhereProvider,
      TEST_HOST_ID,
      createInput({ title: 'Derived location event', cityCode: undefined }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.stateCode).toBe('31');
      expect(result.data.venueAddress).toBe(
        '5 Boulevard Emir Abdelkader, Oran',
      );
    }
  });
});
