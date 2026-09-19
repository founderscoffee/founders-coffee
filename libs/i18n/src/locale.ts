import {
  DEFAULT_LOCALE,
  LOCALES,
  localeSchema,
  localizedName,
  type Locale,
  type LocalizedNames,
} from '@founders-coffee/core';

import { getTextDirection } from './paraglide/runtime.js';

export {
  DEFAULT_LOCALE,
  LOCALES,
  localeSchema,
  localizedName,
  type Locale,
  type LocalizedNames,
};

/** Layout direction for a locale (SRS FR-L2). Arabic → rtl; en/fr → ltr. */
export const direction = (locale: Locale): 'rtl' | 'ltr' =>
  getTextDirection(locale);
