import {
  DEFAULT_LOCALE,
  LOCALES,
  localeSchema,
  type Locale,
} from '@founders-coffee/core';

import { getTextDirection } from './paraglide/runtime.js';

export { DEFAULT_LOCALE, LOCALES, localeSchema, type Locale };

/** Layout direction for a locale (SRS FR-L2). Arabic → rtl; en/fr → ltr. */
export const direction = (locale: Locale): 'rtl' | 'ltr' =>
  getTextDirection(locale);
