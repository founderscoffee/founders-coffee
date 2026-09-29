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
    />,
  );

const rowsUnder = (label: string) => {
  const box = screen.getByText(label).parentElement;
  if (!box) throw new Error(`nothing holds the ${label} label`);
  return within(box).getAllByRole('definition');
};

describe('the Where block', () => {
  it.each([
    ['ar', 'Algiers'],
    ['ar', 'الجزائر'],
    ['fr', 'Alger'],
    ['en', ' algiers '],
  ] as const)(
    'leaves out an address that only names the city, on the %s page (%s)',
    (locale, venueAddress) => {
      show({ ...event, venueAddress }, locale);
      const rows = rowsUnder(WHERE[locale]);

      expect(
        rows,
        'the map provider’s English city name printed under the café on an Arabic page',
      ).toHaveLength(1);
      expect(rows[0]?.textContent).toBe(event.venue);
    },
  );

  it.each(['ar', 'fr', 'en'] as const)(
    'shows an address that names a street, on the %s page',
    (locale) => {
      const venueAddress = '12 Rue Didouche Mourad, Alger';
      show({ ...event, venueAddress }, locale);
      const [, addressRow] = rowsUnder(WHERE[locale]);

      expect(addressRow?.textContent).toBe(venueAddress);
    },
  );
});
