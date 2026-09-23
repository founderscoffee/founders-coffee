import type { DayPickerLocale } from 'react-day-picker';
import { arDZ, enUS, fr } from 'react-day-picker/locale';

import type { Locale } from '@founders-coffee/i18n';

const ARABIC_FULL_DATE = 'EEEE، d MMMM y';
const ARABIC_DATE_PATTERNS: Record<string, string> = {
  full: ARABIC_FULL_DATE,
  long: 'd MMMM y',
  medium: 'd MMM y',
  short: 'dd/MM/yyyy',
};

/**
 * Lays out an Algerian Arabic date the way Arabic lays one out. date-fns ships
 * its ar-DZ locale with the en-US patterns still in place, so a day button's
 * aria-label came out as an American date wearing Arabic month names: the month
 * ahead of the day, an ordinal on the day, and ASCII commas holding together a
 * sentence whose own words use the Arabic one.
 */
const arabicDatePattern = ({ width }: { width?: string } = {}): string =>
  ARABIC_DATE_PATTERNS[width ?? 'full'] ?? ARABIC_FULL_DATE;

export const DAYPICKER_LOCALE: Record<Locale, DayPickerLocale> = {
  ar: {
    ...arDZ,
    formatLong: { ...arDZ.formatLong, date: arabicDatePattern },
  },
  en: enUS,
  fr,
};
