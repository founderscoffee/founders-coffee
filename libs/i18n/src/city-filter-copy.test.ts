import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from './locale.js';
import { no_filter_match } from './paraglide/messages.js';

const NOTHING_MATCHES: Record<Locale, string> = {
  ar: 'لا شيء يطابق هذه الفلاتر.',
  en: 'Nothing matches these filters.',
  fr: 'Rien ne correspond à ces filtres.',
};

describe('city page filter copy', () => {
  it.each<Locale>(LOCALES)(
    'says nothing matches without naming a week the list does not have, in %s',
    (locale) => {
      expect(no_filter_match({}, { locale })).toBe(NOTHING_MATCHES[locale]);
    },
  );
});
