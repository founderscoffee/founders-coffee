import { cleanup, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Market } from '@founders-coffee/db';
import {
  city_empty_cta,
  city_hosts_count,
  city_upcoming_count,
  LOCALES,
  type Locale,
} from '@founders-coffee/i18n';
import type { TrendingHost } from '@founders-coffee/server-fns';

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

type Card = {
  readonly count: number;
  readonly hosts?: readonly TrendingHost[];
  readonly hostCount?: number;
};

const host = (
  name: string,
  photoAssetId: string | null = null,
): TrendingHost => ({ name, photoAssetId });

const show = (cards: readonly Card[], locale: Locale = 'en') =>
  render(
    <TrendingStates
      locale={locale}
      market={market}
      trending={{
        variant: 'major',
        groups: [
          {
            state: null,
            cities: cards.map(
              ({ count, hosts = [], hostCount = hosts.length }, index) => ({
                count,
                hosts,
                hostCount,
                city: city(
                  String(index + 1),
                  `City ${index + 1}`,
                  `city-${index}`,
                ),
              }),
            ),
          },
        ],
      }}
    />,
  );

const groups = (view: ReturnType<typeof show>) => [
  ...view.container.querySelectorAll('.avatar-group'),
];

const faces = (group: Element | undefined) =>
  [...(group?.children ?? [])].map(
    (face) =>
      face.querySelector('img')?.getAttribute('src') ?? face.textContent,
  );

afterEach(cleanup);

describe('who a city card says hosts there', () => {
  it('draws three hosts and counts the rest in a bubble after them', () => {
    const view = show([
      {
        count: 20,
        hosts: [
          host('Amina', 'ast_amina'),
          host('Bilal'),
          host('ياسين بن علي'),
        ],
        hostCount: 7,
      },
    ]);
    const [group] = groups(view);

    expect(faces(group)).toEqual([
      '/media/profile/ast_amina/sm',
      'B',
      'ي',
      '+4',
    ]);
    expect(group?.getAttribute('role')).toBe('img');
    expect(
      group?.getAttribute('aria-label'),
      'the faces carry no names, so the label says how many hosts they stand for',
    ).toBe(city_hosts_count({ count: 7 }, { locale: 'en' }));
  });

  it('adds no bubble when every host has a face', () => {
    const view = show([
      { count: 2, hosts: [host('Amina'), host('Bilal')], hostCount: 2 },
    ]);

    expect(faces(groups(view)[0])).toEqual(['A', 'B']);
  });

  it('keeps the bubble to what fits in it', () => {
    const view = show([
      {
        count: 180,
        hosts: [host('Amina'), host('Bilal'), host('Chahra')],
        hostCount: 150,
      },
    ]);

    expect(faces(groups(view)[0]).at(-1)).toBe('+99');
  });

  it('draws nobody when it has no host it can name', () => {
    const view = show([{ count: 3, hosts: [], hostCount: 2 }]);

    expect(groups(view)).toEqual([]);
  });

  it.each<Locale>([...LOCALES])(
    'draws nobody on a city with nothing on, in %s',
    (locale) => {
      const view = show([{ count: 0 }], locale);

      expect(groups(view)).toEqual([]);
      expect(view.container.textContent).toContain(
        city_empty_cta({}, { locale }),
      );
    },
  );

  it('draws hosts on the busy cities and nobody on the quiet ones', () => {
    const view = show([
      { count: 20, hosts: [host('Amina')] },
      { count: 0 },
      { count: 3, hosts: [host('Bilal')] },
      { count: 0 },
    ]);

    expect(groups(view).map(faces)).toEqual([['A'], ['B']]);
  });
});

describe('how many meetups a city card says it has', () => {
  it.each<Locale>([...LOCALES])(
    'counts every upcoming meetup, not the week’s, in %s',
    (locale) => {
      const view = show([{ count: 20, hosts: [host('Amina')] }], locale);

      expect(
        view.container.querySelector('article')?.textContent,
        'the name, a face, and the count in words: no bare number beside the name',
      ).toBe(`City 1A${city_upcoming_count({ count: 20 }, { locale })}`);
    },
  );

  it('writes a busy city’s count in full', () => {
    const view = show([{ count: 140, hosts: [host('Amina')] }]);

    expect(
      view.getByText(city_upcoming_count({ count: 140 }, { locale: 'en' })),
    ).toBeTruthy();
  });
});
