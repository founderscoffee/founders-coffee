import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import {
  event_details_title,
  going_count,
  hero_search_cta,
  hero_search_placeholder,
  hero_subtitle,
  host_in_your_city,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { EventCard } from '../events/EventCard';
import { MarketHero } from './MarketHero';
import { TrendingStates } from './TrendingStates';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
    params,
    to,
  }: {
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
    to?: string;
  }) =>
    createElement(
      'a',
      {
        href: '/',
        className,
        'data-route': to,
        'data-route-params': params ? JSON.stringify(params) : undefined,
      },
      children,
    ),
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

const event: EventFeedItem = {
  id: 'evt_typography',
  hostId: 'usr_host',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: '1',
  title: 'Founder coffee',
  description: 'A short founder conversation over coffee.',
  venue: 'Coffee shop',
  slug: 'founder-coffee',
  startsAt: new Date('2026-09-18T14:00:00Z'),
  endsAt: null,
  language: 'ar',
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
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  citySlug: 'algiers',
  goingCount: 2,
  hostName: 'Host Name',
  hostPhotoAssetId: null,
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
      expect(description.className.split(' ')).toContain('text-body-lg');
      expect(screen.getByRole('combobox').className.split(' ')).toContain(
        'text-body',
      );
      expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe(
        hero_search_placeholder({}, { locale }),
      );
      expect(
        screen.getByRole('link', {
          name: hero_search_cta({}, { locale }),
        }),
      ).toBeTruthy();
      expect(screen.getByRole('link').className.split(' ')).toContain(
        'text-body',
      );
      expect(screen.getByRole('heading', { level: 1 }).className).toContain(
        'text-display',
      );
      expect(screen.getByRole('search')).toBeTruthy();
      expect(screen.getByRole('region').getAttribute('aria-labelledby')).toBe(
        'market-hero-title',
      );
      expect(screen.queryByText(market.nameAr ?? market.name)).toBeNull();
    },
  );

  it('serves a responsive mobile hero asset', () => {
    const view = render(
      <MarketHero locale="ar" market={market} cityEventCounts={{}} />,
    );
    const sources = view.container.querySelectorAll('picture source');
    expect(sources[0]?.getAttribute('media')).toBe('(max-width: 767px)');
    expect(sources[0]?.getAttribute('srcset')).toMatch(/hero-algeria-mobile/);
    expect(sources[1]?.getAttribute('media')).toBe('(min-width: 768px)');
    expect(sources[1]?.getAttribute('srcset')).toMatch(/hero-algeria-desktop/);
  });

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
      expect(screen.getByText(event.description)).toBeTruthy();
      expect(screen.getByText(event.hostName as string)).toBeTruthy();
      expect(
        screen.getByRole('link', {
          name: event_details_title({}, { locale }),
        }),
      ).toBeTruthy();
      expect(view.container.querySelector('.avatar-group')).toBeTruthy();
      expect(
        view.container.querySelector('.avatar-group')?.className,
      ).toContain('overflow-visible');
      expect(view.container.querySelector('[dir="rtl"]')).toBeTruthy();
      expect(view.container.querySelector('[dir="ltr"]')).toBeTruthy();
      expect(
        view.container
          .querySelector('.avatar-group')
          ?.getAttribute('aria-label'),
      ).toBe(going_count({ count: 2 }, { locale }));
      expect(view.container.textContent).not.toContain(
        going_count({ count: 2 }, { locale }),
      );
      expect(view.container.querySelectorAll('.datechip-line')).toHaveLength(2);
    },
  );

  it('keeps the host avatar but hides the group when no additional attendees exist', () => {
    const view = render(
      <EventCard
        event={{ ...event, rsvps: 1, goingCount: 1 }}
        locale="ar"
        timezone={market.timezone}
        marketSlug={market.slug}
      />,
    );
    expect(view.container.querySelector('.avatar-group')).toBeNull();
    expect(view.container.querySelector('.avatar')).toBeTruthy();
  });

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
                  {
                    count: 0,
                    city: {
                      code: '2',
                      stateCode: '31',
                      name: 'Oran',
                      nameAr: 'وهران',
                      slug: 'oran',
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
      expect(name?.className).toContain('leading-tight');
      expect(name?.className).toContain('text-body-lg');
      expect(view.container.querySelector('a .mt-auto')?.className).toContain(
        'text-body-sm',
      );
      expect(view.container.querySelectorAll('a.aura')).toHaveLength(1);
      expect(view.container.querySelectorAll('a.aura-glow')).toHaveLength(1);
      expect(view.container.querySelectorAll('a.hover-3d')).toHaveLength(0);
      expect(view.container.querySelectorAll('article')).toHaveLength(3);
      expect(view.container.querySelectorAll('data')).toHaveLength(2);
      expect(view.container.querySelector('data[value="0"]')).toBeTruthy();
      expect(
        screen.getByRole('heading', {
          level: 3,
          name: host_in_your_city({}, { locale }),
        }),
      ).toBeTruthy();
      const cityLink = screen.getByRole('link', {
        name: new RegExp(locale === 'ar' ? 'الجزائر' : 'Algiers'),
      });
      expect(cityLink.getAttribute('data-route')).toBe(
        '/$market/$city/$subcity',
      );
      expect(cityLink.getAttribute('data-route-params')).toBe(
        JSON.stringify({
          market: locale,
          city: market.slug,
          subcity: 'algiers',
        }),
      );
    },
  );
});
