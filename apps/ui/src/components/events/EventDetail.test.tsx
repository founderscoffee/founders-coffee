import { cleanup, render } from '@testing-library/react';
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
