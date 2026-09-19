import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import type { EventDetailItem } from '@founders-coffee/server-fns';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

vi.mock('./RsvpSection', () => ({
  RsvpSection: () => null,
}));

vi.mock('./EventLocationMap', () => ({
  EventLocationMap: () => null,
}));

const { EventDetail } = await import('./EventDetail');

const market = {
  code: 'DZ',
  name: 'Algeria',
  nameAr: 'الجزائر',
  slug: 'algeria',
  defaultLocale: 'ar',
  defaultCurrency: 'DZD',
  timezone: 'Africa/Algiers',
  direction: 'rtl',
  state: 'active',
  featureFlags: {
    events: true,
    hackathons: false,
    payments: false,
    recruiting: false,
  },
  brandOverrides: null,
  createdAt: 1_767_225_600,
} satisfies Market;

const event = {
  id: 'evt_1',
  hostId: 'usr_1',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: 'algiers',
  title: 'Founders breakfast',
  description: 'A local founder meetup.',
  venue: 'Café Atlas',
  startsAt: new Date('2026-09-20T10:00:00Z'),
  endsAt: new Date('2026-09-20T12:00:00Z'),
  rsvps: 0,
  language: 'en',
  latitude: null,
  longitude: null,
  venueAddress: null,
  slug: 'founders-breakfast',
  status: 'published',
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  cancelledAt: null,
  cancellationReason: null,
  goingCount: 0,
  viewerRsvp: null,
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  citySlug: 'algiers',
} satisfies EventDetailItem;

afterEach(() => cleanup());

describe('EventDetail structured data ownership', () => {
  it('does not emit a second body-level JSON-LD payload', () => {
    const { container } = render(
      <EventDetail
        locale="en"
        market={market}
        event={event}
        host={null}
        isHost={false}
        live={null}
        isWindowOpen={false}
      />,
    );

    expect(
      container.querySelectorAll('script[type="application/ld+json"]'),
    ).toHaveLength(0);
  });
});

const cancelled = {
  ...event,
  status: 'cancelled',
  goingCount: 3,
  cancelledAt: new Date('2026-09-10T00:00:00Z'),
  cancellationReason: 'The café closed without warning.',
} satisfies EventDetailItem;

const show = (item: EventDetailItem) =>
  render(
    <EventDetail
      locale="en"
      market={market}
      event={item}
      host={null}
      isHost={false}
      live={null}
      isWindowOpen={false}
    />,
  );

describe('EventDetail once the host has called the meetup off', () => {
  it('counts the people coming while the meetup is still on', () => {
    show({ ...event, goingCount: 3 });
    expect(screen.getByText('+3 going')).toBeTruthy();
  });

  it('stops advertising an audience for a meetup nobody can attend', () => {
    show(cancelled);
    expect(screen.queryByText('+3 going')).toBeNull();
  });

  it('does not invite a stranger to save a spot at it', () => {
    show(cancelled);
    expect(screen.queryByText('Save your seat')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your seat' })).toBeNull();
  });

  it('still has a place to address whoever had said they were coming', () => {
    show({ ...cancelled, viewerRsvp: 'going' });
    expect(screen.getByRole('heading', { name: 'Your seat' })).toBeTruthy();
  });
});
