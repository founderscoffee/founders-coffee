import { DateLib } from 'react-day-picker';
import type { DayPickerLocale, Modifiers } from 'react-day-picker';
import { describe, expect, it } from 'vitest';

import { DAYPICKER_LOCALE } from './daypicker-locale';

const WEDNESDAY = new Date('2026-09-23T12:00:00Z');

const label = (locale: DayPickerLocale, modifiers: Modifiers) => {
  const build = locale.labels?.labelDayButton;
  if (typeof build !== 'function')
    throw new Error('this locale spells out no day-button label');
  return build(WEDNESDAY, modifiers, { locale });
};

describe('what a day button tells a screen reader', () => {
  it('writes the Arabic date the way Arabic writes one', () => {
    expect(label(DAYPICKER_LOCALE.ar, {})).toBe('الأربعاء، 23 سبتمبر 2026');
  });

  it('punctuates the whole Arabic label in Arabic', () => {
    const spoken = label(DAYPICKER_LOCALE.ar, { today: true, selected: true });

    expect(
      spoken.match(/,/gu),
      'the date inside the label arrived with ASCII commas while the words around it used the Arabic one',
    ).toBeNull();
    expect(spoken).toBe('اليوم، الأربعاء، 23 سبتمبر 2026، محدد');
  });

  it('leaves the English and French dates as their own languages write them', () => {
    expect(label(DAYPICKER_LOCALE.en, {})).toBe(
      'Wednesday, September 23rd, 2026',
    );
    expect(label(DAYPICKER_LOCALE.fr, {})).toBe('mercredi 23 septembre 2026');
  });

  it.each([
    ['PPPP', 'الأربعاء، 23 سبتمبر 2026'],
    ['PPP', '23 سبتمبر 2026'],
    ['PP', '23 سبتمبر 2026'],
    ['P', '23/09/2026'],
  ])('puts the Arabic day ahead of its month at %s', (pattern, expected) => {
    const lib = new DateLib({ locale: DAYPICKER_LOCALE.ar });

    expect(lib.format(WEDNESDAY, pattern)).toBe(expected);
  });

  it('names every month as the rest of the site does', () => {
    const lib = new DateLib({ locale: DAYPICKER_LOCALE.ar });
    const site = new Intl.DateTimeFormat('ar', { month: 'long' });

    for (let month = 0; month < 12; month += 1) {
      const date = new Date(2027, month, 15, 12);
      expect(
        lib.format(date, 'LLLL'),
        'the picker spoke Algerian Arabic (جانفي, أفريل) to hosts in every market, beside meetup pages that say يناير and أبريل',
      ).toBe(site.format(date));
    }
  });

  it('starts the Arabic week on Sunday, as the picker always has', () => {
    expect(DAYPICKER_LOCALE.ar.options?.weekStartsOn).toBe(0);
  });

  it('answers a width it does not spell out with the full date', () => {
    const { date } = DAYPICKER_LOCALE.ar.formatLong;

    expect(date({ width: 'any' })).toBe(date({ width: 'full' }));
  });
});
