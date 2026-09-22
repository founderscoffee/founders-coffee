import { cleanup, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import { city_empty_cta, LOCALES, type Locale } from '@founders-coffee/i18n';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => createElement('a', { href: '/', className }, children),
}));

const { TrendingStates } = await import('./TrendingStates');

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

const city = (code: string, name: string, slug: string) => ({
  code,
  stateCode: '16',
  name,
  nameAr: name,
  slug,
  featured: true,
});

const show = (counts: readonly number[], locale: Locale = 'en') =>
  render(
    <TrendingStates
      locale={locale}
      market={market}
      trending={{
        variant: 'major',
        groups: [
          {
            state: null,
            cities: counts.map((count, index) => ({
              count,
              city: city(
                String(index + 1),
                `City ${index + 1}`,
                `city-${index}`,
              ),
            })),
          },
        ],
      }}
    />,
  );

const numbers = (view: ReturnType<typeof show>) =>
  [...view.container.querySelectorAll('data')].map((node) => node.textContent);

afterEach(cleanup);

describe('how many meetups a city card says it has', () => {
  it.each<Locale>([...LOCALES])(
    'writes no number on a city with nothing on, in %s',
    (locale) => {
      const view = show([0], locale);

      expect(
        numbers(view),
        'a row of zeroes reads as a market nobody turns up to; the invitation below already says it is empty',
      ).toEqual([]);
      expect(view.container.textContent).toContain(
        city_empty_cta({}, { locale }),
      );
    },
  );

  it('writes the number as soon as there is one meetup', () => {
    expect(numbers(show([1]))).toEqual(['1']);
  });

  it('writes a number for the busy cities and nothing for the quiet ones', () => {
    expect(numbers(show([20, 0, 3, 0]))).toEqual(['20', '3']);
  });

  it('still caps a very busy city rather than printing it in full', () => {
    expect(numbers(show([140]))).toEqual(['+99']);
  });
});
