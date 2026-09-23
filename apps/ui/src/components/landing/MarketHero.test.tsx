import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import { hero_search_cta, type Locale } from '@founders-coffee/i18n';

import { CitySelectionFeedback } from './CitySelectionFeedback';
import { EmptyCityCard } from './EmptyCityCard';
import { MarketHero } from './MarketHero';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
    to,
  }: {
    children: ReactNode;
    className?: string;
    to?: string;
  }) => createElement('a', { href: to, className }, children),
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

const egypt: Market = {
  ...market,
  code: 'EG',
  name: 'Egypt',
  nameAr: 'مصر',
  nameFr: 'Égypte',
  slug: 'egypt',
  defaultCurrency: 'EGP',
  timezone: 'Africa/Cairo',
};

const cairo: geo.GeoCity = {
  code: '397',
  name: 'Cairo',
  nameAr: 'القاهرة',
  nameFr: 'Le Caire',
  slug: 'cairo',
  stateCode: '1',
  featured: true,
};

afterEach(cleanup);

describe('MarketHero call to action', () => {
  it.each<Locale>(['ar', 'fr', 'en'])(
    'sends a visitor who has chosen no city to the public feed, not to sign-in, in %s',
    (locale) => {
      render(
        <MarketHero locale={locale} market={market} cityEventCounts={{}} />,
      );

      const cta = screen.getByRole('link', {
        name: hero_search_cta({}, { locale }),
      });

      expect(cta.getAttribute('href')).toBe('#market-events');
    },
  );

  it('leaves the call to action free of a permanent active state', () => {
    render(<MarketHero locale="ar" market={market} cityEventCounts={{}} />);

    const cta = screen.getByRole('link', {
      name: hero_search_cta({}, { locale: 'ar' }),
    });

    expect(cta.getAttribute('aria-current')).toBeNull();
    expect(cta.className.split(' ')).not.toContain('active');
  });
});

describe('the hero names the chosen city the way French does', () => {
  it('counts the meetups au Caire', () => {
    const { container } = render(
      <CitySelectionFeedback
        locale="fr"
        selectedCityCount={2}
        cityDisplayName="Le Caire"
      />,
    );

    expect(container.textContent).toBe('2 rencontres cette semaine au Caire');
  });

  it('says there are none au Caire yet', () => {
    render(
      <EmptyCityCard
        locale="fr"
        market={egypt}
        selectedCity={cairo}
        cityDisplayName="Le Caire"
      />,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Pas de rencontres au Caire pour le moment',
    );
  });
});
