import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from './locale.js';
import { load_more_error, no_filter_match } from './paraglide/messages.js';

const NOTHING_MATCHES: Record<Locale, string> = {
  ar: 'لا توجد لقاءات تطابق هذه الفلاتر.',
  en: 'No meetups match these filters.',
  fr: 'Aucune rencontre ne correspond à ces filtres.',
};

const MORE_UNAVAILABLE: Record<Locale, string> = {
  ar: 'تعذّر تحميل المزيد من اللقاءات.',
  en: 'Could not load more meetups.',
  fr: 'Impossible de charger d’autres rencontres.',
};

describe('city page filter copy', () => {
  it.each<Locale>(LOCALES)(
    'says nothing matches without naming a week the list does not have, in %s',
    (locale) => {
      expect(no_filter_match({}, { locale })).toBe(NOTHING_MATCHES[locale]);
    },
  );

  it.each<Locale>(LOCALES)(
    'says more meetups could not be loaded, rather than that none match, in %s',
    (locale) => {
      expect(load_more_error({}, { locale })).toBe(MORE_UNAVAILABLE[locale]);
    },
  );
});
