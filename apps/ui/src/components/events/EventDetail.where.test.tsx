import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type Locale } from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import { event, market } from './EventDetail.fixtures';

const { EventDetail } = await import('./EventDetail');

afterEach(() => cleanup());

const WHERE = { ar: 'أين', fr: 'Où', en: 'Where' } satisfies Record<
  Locale,
  string
>;

const show = (item: EventDetailItem, locale: Locale) =>
  render(
    <EventDetail
      locale={locale}
      market={market}
      event={item}
      host={null}
      isHost={false}
      live={null}
      isWindowOpen={false}
      phase="upcoming"
      mapboxToken={null}
    />,
  );

const rowsUnder = (label: string) => {
  const box = screen.getByText(label).parentElement;
  if (!box) throw new Error(`nothing holds the ${label} label`);
  return within(box).getAllByRole('definition');
};

const CITY = {
  ar: event.cityNameAr,
  fr: event.cityNameFr,
  en: event.cityName,
} satisfies Record<Locale, string>;

describe('the Where block', () => {
  it.each([
    ['ar', 'Algiers'],
    ['ar', 'الجزائر'],
    ['fr', 'Alger'],
    ['en', ' algiers '],
  ] as const)(
    'names the city in the page’s language where the address only names it, on the %s page (%s)',
    (locale, venueAddress) => {
      show({ ...event, venueAddress }, locale);
      const rows = rowsUnder(WHERE[locale]);

      expect(rows.map((row) => row.textContent)).toEqual([
        event.venue,
        CITY[locale],
      ]);
    },
  );

  it.each(['ar', 'fr', 'en'] as const)(
    'names the city where the meetup has no address, on the %s page',
    (locale) => {
      show({ ...event, venueAddress: null }, locale);
      const rows = rowsUnder(WHERE[locale]);

      expect(
        rows.map((row) => row.textContent),
        'a café known only by its name left the box without a place to go to',
      ).toEqual([event.venue, CITY[locale]]);
    },
  );

  it.each(['ar', 'fr', 'en'] as const)(
    'shows an address that names a street, on the %s page',
    (locale) => {
      const venueAddress = '12 Rue Didouche Mourad, Alger';
      show({ ...event, venueAddress }, locale);
      const rows = rowsUnder(WHERE[locale]);

      expect(rows.map((row) => row.textContent)).toEqual([
        event.venue,
        venueAddress,
      ]);
    },
  );
});
