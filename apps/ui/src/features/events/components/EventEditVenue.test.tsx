import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

const seen = vi.hoisted(() => ({
  venueStep: null as Record<string, unknown> | null,
}));

vi.mock('../hooks', () => ({
  useHostMapContext: () => ({
    data: {
      center: { latitude: 36.7538, longitude: 3.0588 },
      bounds: [2.9, 36.6, 3.3, 36.9],
    },
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../components/host/HostMapPanel', () => ({
  HostMapPanel: () => <div data-testid="map" />,
}));

vi.mock('../../../components/host/HostVenueStep', () => ({
  HostVenueStep: (props: Record<string, unknown>) => {
    seen.venueStep = props;
    return <div data-testid="venue-list" />;
  },
}));

const { EventEditVenue } = await import('./EventEditVenue');

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
  cityNameFr: 'Alger',
  citySlug: 'algiers',
} satisfies EventDetailItem;

const show = (locale: Locale = 'en', item: EventDetailItem = event) =>
  render(
    <EventEditVenue
      locale={locale}
      event={item}
      mapboxToken="pk.test"
      venue={null}
      searchValue=""
      onSearchChange={() => undefined}
      onVenueSelect={() => undefined}
      onVenueInvalidate={() => undefined}
    />,
  );

afterEach(() => {
  cleanup();
  seen.venueStep = null;
});

describe('keeping the page still while the host picks a place', () => {
  it('puts the map above the list, never below it', () => {
    show();

    const map = screen.getByTestId('map');
    const list = screen.getByTestId('venue-list');

    expect(
      map.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
      'picking a venue collapses forty rows to one, and anything that shrinks above the map drags the page out from under the host mid-click',
    ).toBeTruthy();
  });

  it('asks the list to stay inside a box of its own', () => {
    show();

    expect(
      seen.venueStep?.boundedList,
      'this page scrolls as one, so an unbounded list buries the date picker and the save button under forty cafes',
    ).toBe(true);
  });

  it('leaves naming the place to the form, which offers it for every venue', () => {
    show();

    expect(seen.venueStep?.hideNameField).toBe(true);
  });
});

describe('what the venue search calls the city', () => {
  it('names it the way a French reader knows it', () => {
    show('fr', { ...event, cityName: 'Cairo', cityNameFr: 'Le Caire' });

    expect(
      seen.venueStep?.area,
      'the search box read "Rechercher un café ou espace de coworking à Cairo…"',
    ).toEqual({ kind: 'city', name: 'Le Caire' });
  });
});
