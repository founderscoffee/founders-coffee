import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Money } from '@founders-coffee/core';

import {
  formatDate,
  formatMoney,
  formatNumber,
  formatScheduleDateTime,
  hasOnlyLatinDigits,
} from './format.js';

const arMoney: Money = { amount_minor: 123456, currency: 'DZD' };

describe('libs/i18n formatting (Latin digits forced)', () => {
  it('formats money with Latin digits even for ar', () => {
    const ar = formatMoney(arMoney, 'ar');
    expect(hasOnlyLatinDigits(ar)).toBe(true);
    expect(ar).toMatch(/[0-9]/);
    expect(ar).toContain('56');

    const fr = formatMoney(arMoney, 'fr');
    expect(hasOnlyLatinDigits(fr)).toBe(true);
    expect(fr).toContain('56');
  });

  it('formats numbers with Latin digits for ar', () => {
    const ar = formatNumber(1234567, 'ar');
    expect(hasOnlyLatinDigits(ar)).toBe(true);
    expect(ar).toContain('1');
  });

  it('formats a date in the market timezone with Latin digits', () => {
    const fixed = new Date('2026-06-26T10:00:00Z');
    const ar = formatDate(fixed, 'ar', {
      timeZone: 'Africa/Algiers',
      dateStyle: 'medium',
    });
    expect(hasOnlyLatinDigits(ar)).toBe(true);
    expect(ar).toContain('2026');

    const fr = formatDate(fixed, 'fr', {
      timeZone: 'Africa/Casablanca',
      dateStyle: 'medium',
    });
    expect(hasOnlyLatinDigits(fr)).toBe(true);
  });

  it.each(['ar', 'fr', 'en'] as const)(
    'formats a %s schedule confirmation with a numeric market offset',
    (locale) => {
      const formatted = formatScheduleDateTime(
        Date.UTC(2026, 8, 15, 17, 30),
        locale,
        'Africa/Algiers',
      );
      expect(hasOnlyLatinDigits(formatted)).toBe(true);
      expect(formatted).toContain('18:30');
      expect(formatted).toContain('01:00');
    },
  );
});

describe('a weekday every engine writes alike', () => {
  const formatters = Intl.DateTimeFormat.prototype as unknown as {
    format: unknown;
  };
  const formatOf = Object.getOwnPropertyDescriptor(formatters, 'format')?.get;
  const week = Array.from(
    { length: 7 },
    (_, day) => new Date(Date.UTC(2026, 9, 4 + day, 17)),
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the full Arabic weekday, which Apple’s ICU writes as V8 does', () => {
    vi.spyOn(formatters, 'format', 'get')
      // eslint-disable-next-line no-restricted-syntax -- a getter's `this` is the formatter it was read from, which an arrow function cannot see.
      .mockImplementation(function (this: Intl.DateTimeFormat) {
        const format = formatOf?.call(this) as (date?: Date | number) => string;
        const { locale, weekday } = this.resolvedOptions();
        return (date?: Date | number) =>
          locale === 'ar' && weekday === 'short'
            ? format(date).replace(/^ال/u, '')
            : format(date);
      });

    expect(
      week.map((date) =>
        formatDate(date, 'ar', {
          timeZone: 'Africa/Algiers',
          weekday: 'short',
        }),
      ),
      'Apple’s ICU has short Arabic weekdays of its own, without the article, so an iPhone hydrated a page with other text than the server wrote',
    ).toEqual([
      'الأحد',
      'الاثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
      'السبت',
    ]);
  });

  it.each([
    ['fr', 'lun.'],
    ['en', 'Mon'],
  ] as const)('keeps the short weekday in %s', (locale, monday) => {
    expect(
      formatDate(week[1], locale, {
        timeZone: 'Africa/Algiers',
        weekday: 'short',
      }),
    ).toBe(monday);
  });
});
