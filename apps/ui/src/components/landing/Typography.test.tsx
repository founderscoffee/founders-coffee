import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import { hero_subtitle, type Locale } from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { EventCard } from '../events/EventCard';
import { MarketHero } from './MarketHero';
import { TrendingStates } from './TrendingStates';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => createElement('a', { href: '/', className }, children),
}));
vi.mock('../../features/geo/hooks', () => ({
  useCitySearch: () => ({ data: [], isFetching: false }),
}));
vi.mock('../../features/auth/hooks', () => ({
  usePublicAuthConfig: () => ({ data: undefined }),
}));
vi.mock('../../features/waitlist/hooks', () => ({
  useJoinWaitlist: () => ({ isPending: false }),
}));

const market: Market = {
  code: 'DZ',
  name: 'Algeria',
  nameAr: 'الجزائر',
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

const event: EventFeedItem = {
  id: 'evt_typography',
  hostId: 'usr_host',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: '1',
  title: 'Founder coffee',
  description: '',
  venue: 'Coffee shop',
  slug: 'founder-coffee',
  startsAt: new Date('2026-09-18T14:00:00Z'),
  endsAt: null,
  language: 'ar',
  rsvps: 1,
  latitude: null,
  longitude: null,
  venueAddress: null,
  status: 'published',
  createdAt: new Date(0),
  updatedAt: new Date(0),
  cancelledAt: null,
  cancellationReason: null,
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  citySlug: 'algiers',
  goingCount: 1,
};

afterEach(cleanup);

describe('P1-002 landing typography', () => {
  it.each<Locale>(['ar', 'fr', 'en'])(
    'uses readable hero and search sizes in %s',
    (locale) => {
      render(
        <MarketHero locale={locale} market={market} cityEventCounts={{}} />,
      );
      const description = screen.getByText(hero_subtitle({}, { locale }));
      expect(description.className.split(' ')).toContain('text-body');
      expect(description.className).toContain('md:text-body-lg');
      expect(screen.getByRole('combobox').className.split(' ')).toContain(
        'text-body',
      );
      expect(screen.getByRole('link').className.split(' ')).toContain(
        'text-body',
      );
      expect(screen.getByRole('heading', { level: 1 }).className).toContain(
        'md:text-h1',
      );
    },
  );

  it.each<Locale>(['ar', 'fr', 'en'])(
    'keeps event titles and metadata while enlarging attendance in %s',
    (locale) => {
      const view = render(
        <EventCard
          event={event}
          locale={locale}
          timezone={market.timezone}
          marketSlug={market.slug}
        />,
      );
      expect(screen.getByText(event.title).className.split(' ')).toContain(
        'text-body',
      );
      expect(
        view.container.querySelector('.mt-auto > span')?.className,
      ).toContain('text-body-sm');
      expect(view.container.querySelectorAll('.datechip-line')).toHaveLength(2);
    },
  );

  it.each<Locale>(['ar', 'fr', 'en'])(
    'gives city names breathing room and larger subtitles in %s',
    (locale) => {
      const view = render(
        <TrendingStates
          locale={locale}
          market={market}
          trending={{
            variant: 'major',
            groups: [
              {
                state: null,
                cities: [
                  {
                    count: 1,
                    city: {
                      code: '1',
                      stateCode: '16',
                      name: 'Algiers',
                      nameAr: 'الجزائر',
                      slug: 'algiers',
                      featured: true,
                    },
                  },
                ],
              },
            ],
          }}
        />,
      );
      const name = view.container.querySelector('a .font-display');
      expect(name?.className).toContain('leading-snug');
      expect(name?.className).toContain('text-body-lg');
      expect(view.container.querySelector('a > .mt-auto')?.className).toContain(
        'text-body-sm',
      );
    },
  );
});
