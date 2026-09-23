import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  back_to_market,
  city_empty_cta,
  city_empty_title,
  city_events_description,
  city_upcoming_title,
  clear_city_filters,
  filter_today,
  host_meetup_here,
  LOCALES,
  no_filter_match,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { CityLanding } from './CityLanding';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => createElement('a', { href: '/', className }, children),
}));
vi.mock('../../features/events/hooks', () => ({
  useUpcomingEvents: () => ({
    data: undefined,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => undefined,
  }),
}));

const market: Market = {
  code: 'DZ',
  name: 'Algeria',
  nameAr: 'الجزائر',
  nameFr: 'Algérie',
  slug: 'algeria',
  defaultLocale: 'ar',
  defaultCurrency: 'DZD',
  timezone: 'Africa/Algiers',
  direction: 'rtl',
  state: 'active',
  brandOverrides: null,
  createdAt: 0,
  featureFlags: {
    events: true,
    hackathons: false,
    payments: false,
    recruiting: false,
  },
};

const oran: geo.GeoCity = {
  code: '1131',
  name: 'Oran',
  nameAr: 'وهران',
  slug: 'oran',
  stateCode: '31',
  featured: true,
};

const oranByLocale: Record<Locale, string> = {
  ar: 'وهران',
  fr: 'Oran',
  en: 'Oran',
};

const event: EventFeedItem = {
  id: 'evt_city_landing',
  hostId: 'usr_host',
  marketCode: 'DZ',
  stateCode: '31',
  cityCode: '1131',
  title: 'Founder coffee',
  description: 'A short founder conversation over coffee.',
  venue: 'Coffee shop',
  slug: 'founder-coffee',
  startsAt: new Date('2099-09-18T14:00:00Z'),
  endsAt: null,
  language: 'en',
  rsvps: 2,
  latitude: null,
  longitude: null,
  venueAddress: null,
  status: 'published',
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  cancelledAt: null,
  cancellationReason: null,
  cityName: 'Oran',
  cityNameAr: 'وهران',
  citySlug: 'oran',
  goingCount: 2,
  hostName: 'Host Name',
  hostPhotoAssetId: null,
};

afterEach(cleanup);

describe('city page', () => {
  it.each<Locale>(LOCALES)(
    'heads a city with nothing on by its name and invites a host beneath it in %s',
    (locale) => {
      const city = oranByLocale[locale];
      render(
        <CityLanding locale={locale} market={market} city={oran} events={[]} />,
      );

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(city);
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
        city_empty_title({ city }, { locale }),
      );
    },
  );

  it('gives a city with nothing on one way to host and one way back', () => {
    render(<CityLanding locale="en" market={market} city={oran} events={[]} />);

    expect(
      screen.getAllByRole('link', {
        name: city_empty_cta({}, { locale: 'en' }),
      }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('link', {
        name: host_meetup_here({}, { locale: 'en' }),
      }),
    ).toBeNull();
    expect(
      screen.getAllByRole('link', {
        name: back_to_market({ market: 'Algeria' }, { locale: 'en' }),
      }),
    ).toHaveLength(1);
    expect(
      screen.queryByText(
        city_events_description({ city: 'Oran' }, { locale: 'en' }),
      ),
    ).toBeNull();
  });

  it('keeps the description and the host button above a city with meetups', () => {
    render(
      <CityLanding locale="en" market={market} city={oran} events={[event]} />,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Oran');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      city_upcoming_title({ city: 'Oran' }, { locale: 'en' }),
    );
    expect(
      screen.getByText(
        city_events_description({ city: 'Oran' }, { locale: 'en' }),
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByRole('link', {
        name: host_meetup_here({}, { locale: 'en' }),
      }),
    ).toHaveLength(1);
  });

  it.each<Locale>(LOCALES)(
    'says nothing matches when the chips leave no meetup, until they are cleared, in %s',
    (locale) => {
      const meetups = {
        name: city_upcoming_title({ city: oranByLocale[locale] }, { locale }),
      };
      const nothingMatches = {
        level: 2,
        name: no_filter_match({}, { locale }),
      };
      render(
        <CityLanding
          locale={locale}
          market={market}
          city={oran}
          events={[event]}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: filter_today({}, { locale }) }),
      );

      expect(screen.queryByRole('list', meetups)).toBeNull();
      expect(screen.getByRole('heading', nothingMatches)).toBeTruthy();

      fireEvent.click(
        screen.getByRole('button', {
          name: clear_city_filters({}, { locale }),
        }),
      );

      expect(screen.getByRole('list', meetups)).toBeTruthy();
      expect(screen.queryByRole('heading', nothingMatches)).toBeNull();
    },
  );
});
