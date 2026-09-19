import { cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import { hero_search_cta, type Locale } from '@founders-coffee/i18n';

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
