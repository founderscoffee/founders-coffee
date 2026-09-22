import { describe, expect, it } from 'vitest';

import type { EventDetailItem } from '@founders-coffee/server-fns';

import {
  draftFromEvent,
  hasPlaceMoved,
  locationPatch,
  nameFor,
  storedPin,
} from './event-edit-draft';
import type { VenueSelection } from './types';

const event = {
  id: 'evt_1',
  hostId: 'usr_1',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: '556',
  title: 'Founders breakfast',
  description: 'A local founder meetup worth showing up to.',
  venue: 'Café Atlas',
  startsAt: new Date('2099-09-20T10:00:00Z'),
  endsAt: new Date('2099-09-20T12:00:00Z'),
  rsvps: 4,
  language: 'en',
  latitude: 36.7538,
  longitude: 3.0588,
  venueAddress: '12 Rue des Entrepreneurs, Alger',
  slug: 'founders-breakfast',
  status: 'published',
  version: 3,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  cancelledAt: null,
  cancellationReason: null,
  goingCount: 4,
  viewerRsvp: 'going',
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  citySlug: 'algiers',
} satisfies EventDetailItem;

const unpinned = { ...event, latitude: null, longitude: null };

const picked = (over: Partial<VenueSelection> = {}): VenueSelection => ({
  providerId: 'osm:1234',
  kind: 'poi',
  name: 'Café Tantonville',
  address: '5 Place Port Saïd, Alger',
  latitude: 36.7558,
  longitude: 3.0588,
  ...over,
});

describe('the pin the map opens on', () => {
  it('is the meetup’s own point, so the host is not asked to find their café again', () => {
    const pin = storedPin(event);

    expect(pin?.latitude).toBe(event.latitude);
    expect(pin?.name).toBe(event.venue);
  });

  it('is nothing at all for the majority of rows, which carry no coordinates', () => {
    expect(storedPin(unpinned)).toBeNull();
  });
});

describe('what a save carries about where the meetup is', () => {
  it('says nothing when the host never touched the map', () => {
    expect(
      locationPatch(event, draftFromEvent(event)),
      'sending the point back unchanged is how a form ends up inventing one for a row that has none',
    ).toBeNull();
  });

  it('still says nothing for a meetup that had no point and was left alone', () => {
    expect(locationPatch(unpinned, draftFromEvent(unpinned))).toBeNull();
  });

  it('carries the new point once the host picks somewhere else', () => {
    const draft = { ...draftFromEvent(event), venue: picked() };

    expect(locationPatch(event, draft)).toEqual({
      latitude: 36.7558,
      longitude: 3.0588,
      venueAddress: '5 Place Port Saïd, Alger',
      venueProviderId: 'osm:1234',
    });
  });

  it('drops an address too long for the schema rather than sending half of one', () => {
    const draft = {
      ...draftFromEvent(event),
      venue: picked({ address: 'x'.repeat(501) }),
    };

    expect(locationPatch(event, draft)).not.toHaveProperty('venueAddress');
  });
});

describe('whether the host is warned before saving', () => {
  it('stays quiet for a pin nudged onto the doorway', () => {
    const draft = {
      ...draftFromEvent(event),
      venue: picked({ latitude: 36.7542 }),
    };

    expect(hasPlaceMoved(event, draft)).toBe(false);
  });

  it('warns once the café is a block away', () => {
    expect(
      hasPlaceMoved(event, { ...draftFromEvent(event), venue: picked() }),
    ).toBe(true);
  });

  it('does not warn about a first pin on a meetup that never had one', () => {
    expect(
      hasPlaceMoved(unpinned, { ...draftFromEvent(unpinned), venue: picked() }),
      'the page still names the same café; the host has only said where it is',
    ).toBe(false);
  });
});

describe('naming the place the host just chose', () => {
  it('takes the name of a café picked from the list', () => {
    expect(nameFor(draftFromEvent(event), picked())).toBe('Café Tantonville');
  });

  it('keeps the published name when the host only dropped a pin', () => {
    expect(
      nameFor(draftFromEvent(event), picked({ kind: 'address' })),
      'emptying the field because the pin moved would make the host retype a name people already read',
    ).toBe('Café Atlas');
  });
});
