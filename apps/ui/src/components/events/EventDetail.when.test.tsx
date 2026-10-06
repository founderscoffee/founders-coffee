import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type Locale } from '@founders-coffee/i18n';

import { event, market } from './EventDetail.fixtures';

const { EventDetail } = await import('./EventDetail');

afterEach(() => cleanup());

const PAGE = {
  ar: {
    when: 'متى',
    where: 'أين',
    day: 'الأحد، 20 سبتمبر',
    time: 'من 11:00 إلى 13:00',
    clock: 'التوقيت المحلي في الجزائر',
  },
  fr: {
    when: 'Quand',
    where: 'Où',
    day: 'dim. 20 sept.',
    time: '11:00–13:00',
    clock: 'Heure locale d’Algérie',
  },
  en: {
    when: 'When',
    where: 'Where',
    day: 'Sun, Sep 20',
    time: '11:00–13:00',
    clock: 'Local time in Algeria',
  },
} satisfies Record<Locale, Record<string, string>>;

const LOCALES = ['ar', 'fr', 'en'] as const;

const show = (locale: Locale) =>
  render(
    <EventDetail
      locale={locale}
      market={market}
      event={event}
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

const iconLook = (row: HTMLElement | undefined) =>
  (row?.querySelector('svg')?.getAttribute('class') ?? '')
    .split(' ')
    .filter((name) => !name.startsWith('lucide'))
    .sort();

describe('the When block', () => {
  it.each(LOCALES)('gives the day a line of its own in %s', (locale) => {
    show(locale);
    const [dayRow] = rowsUnder(PAGE[locale].when);

    expect(dayRow?.textContent).toBe(PAGE[locale].day);
    const day = screen.getAllByText(PAGE[locale].day)[0];
    expect(day?.tagName).toBe('TIME');
    expect(day?.getAttribute('datetime')).toBe(event.startsAt.toISOString());
  });

  it.each(LOCALES)(
    'puts the time on the line that says whose clock it is, in %s',
    (locale) => {
      show(locale);
      const [, timeRow] = rowsUnder(PAGE[locale].when);

      expect(timeRow?.textContent).toBe(
        `${PAGE[locale].time}${PAGE[locale].clock}`,
      );
    },
  );

  it('draws the day’s calendar the way the venue’s pin is drawn', () => {
    show('ar');
    const [dayRow] = rowsUnder(PAGE.ar.when);
    const [venueRow] = rowsUnder(PAGE.ar.where);

    expect(
      dayRow?.querySelector('svg')?.classList.contains('lucide-calendar-days'),
    ).toBe(true);
    expect(iconLook(dayRow)).toEqual(iconLook(venueRow));
    expect(iconLook(dayRow)).toContain('size-4');
  });
});

describe('the day and month on the event page', () => {
  it.each(LOCALES)(
    'are written the way %s abbreviates them, in the header and the When block',
    (locale) => {
      show(locale);

      const dates = screen.getAllByText(
        (_, element) =>
          element?.tagName === 'TIME' &&
          element.textContent?.startsWith(PAGE[locale].day) === true,
      );
      expect(dates).toHaveLength(2);
    },
  );
});
