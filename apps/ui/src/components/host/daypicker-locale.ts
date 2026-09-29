import type { DayPickerLocale } from 'react-day-picker';
import { ar, enUS, fr } from 'react-day-picker/locale';

import type { Locale } from '@founders-coffee/i18n';

export const DAYPICKER_LOCALE: Record<Locale, DayPickerLocale> = {
  ar: { ...ar, options: { ...ar.options, weekStartsOn: 0 } },
  en: enUS,
  fr,
};
