import { describe, expect, it } from 'vitest';

import {
  account_sessions_count,
  city_loaded_count,
  going_count,
  hero_social_proof,
} from './paraglide/messages.js';

const CATEGORY_SAMPLE = {
  zero: 0,
  one: 1,
  two: 2,
  few: 3,
  many: 11,
  other: 100,
} as const;

type Category = keyof typeof CATEGORY_SAMPLE;

/** Renders one message at the smallest count in each Arabic plural category. */
const arabicForms = (
  render: (count: number) => string,
): Record<Category, string> =>
  Object.fromEntries(
    Object.entries(CATEGORY_SAMPLE).map(([category, count]) => [
      category,
      render(count),
    ]),
  ) as Record<Category, string>;

describe('Arabic number agreement', () => {
  it('declines the attendee noun with the count', () => {
    expect(
      arabicForms((count) => going_count({ count }, { locale: 'ar' })),
    ).toEqual({
      zero: '+0 مشاركين',
      one: '+1 مشارك',
      two: '+2 مشاركان',
      few: '+3 مشاركين',
      many: '+11 مشاركًا',
      other: '+100 مشارك',
    });
  });

  it('declines the meetup noun in the city hero', () => {
    const render = (count: number) =>
      hero_social_proof({ count, city: 'وهران' }, { locale: 'ar' });
    expect(arabicForms(render)).toEqual({
      zero: '0 لقاءات هذا الأسبوع في وهران',
      one: '1 لقاء هذا الأسبوع في وهران',
      two: '2 لقاءان هذا الأسبوع في وهران',
      few: '3 لقاءات هذا الأسبوع في وهران',
      many: '11 لقاءً هذا الأسبوع في وهران',
      other: '100 لقاء هذا الأسبوع في وهران',
    });
  });

  it('puts the counted meetup in the genitive after the verbal noun', () => {
    expect(
      arabicForms((count) => city_loaded_count({ count }, { locale: 'ar' })),
    ).toEqual({
      zero: 'عرض 0 لقاءات',
      one: 'عرض 1 لقاء',
      two: 'عرض 2 لقاءين',
      few: 'عرض 3 لقاءات',
      many: 'عرض 11 لقاءً',
      other: 'عرض 100 لقاء',
    });
  });

  it('declines the signed-in noun on the account page', () => {
    expect(
      arabicForms((count) =>
        account_sessions_count({ count }, { locale: 'ar' }),
      ),
    ).toEqual({
      zero: '0 مسجّلين الآن',
      one: '1 مسجّل الآن',
      two: '2 مسجّلان الآن',
      few: '3 مسجّلين الآن',
      many: '11 مسجّلًا الآن',
      other: '100 مسجّل الآن',
    });
  });

  it('keeps 11 through 99 on the singular, which is where it reads wrong', () => {
    for (const count of [11, 22, 47, 99]) {
      expect(going_count({ count }, { locale: 'ar' })).toBe(
        `+${count} مشاركًا`,
      );
      expect(city_loaded_count({ count }, { locale: 'ar' })).toBe(
        `عرض ${count} لقاءً`,
      );
    }
  });
});

describe('French and English number agreement', () => {
  it('keeps the French noun singular through zero and one', () => {
    expect(going_count({ count: 0 }, { locale: 'fr' })).toBe('+0 participant');
    expect(going_count({ count: 1 }, { locale: 'fr' })).toBe('+1 participant');
    expect(going_count({ count: 2 }, { locale: 'fr' })).toBe('+2 participants');
  });

  it('agrees the French participle with its noun', () => {
    expect(city_loaded_count({ count: 1 }, { locale: 'fr' })).toBe(
      '1 rencontre affichée',
    );
    expect(city_loaded_count({ count: 4 }, { locale: 'fr' })).toBe(
      '4 rencontres affichées',
    );
    expect(account_sessions_count({ count: 1 }, { locale: 'fr' })).toBe(
      '1 connecté en ce moment',
    );
    expect(account_sessions_count({ count: 3 }, { locale: 'fr' })).toBe(
      '3 connectés en ce moment',
    );
  });

  it('drops the English plural at one only', () => {
    expect(city_loaded_count({ count: 0 }, { locale: 'en' })).toBe(
      'Showing 0 meetups',
    );
    expect(city_loaded_count({ count: 1 }, { locale: 'en' })).toBe(
      'Showing 1 meetup',
    );
    expect(city_loaded_count({ count: 2 }, { locale: 'en' })).toBe(
      'Showing 2 meetups',
    );
  });
});
