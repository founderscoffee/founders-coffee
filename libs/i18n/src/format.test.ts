import { describe, expect, it } from 'vitest';

import type { Money } from '@founders-coffee/core';

import { formatDate, formatMoney, formatNumber, hasOnlyLatinDigits } from './format.js';

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
});
