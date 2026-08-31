import { baseLocale, getTextDirection, locales } from './paraglide/runtime.js';

export type Locale = (typeof locales)[number];

export const DEFAULT_LOCALE: Locale = baseLocale;

export const LOCALES: readonly Locale[] = locales;

/** Layout direction for a locale (SRS FR-L2). Arabic → rtl; en/fr → ltr. */
export const direction = (locale: Locale): 'rtl' | 'ltr' =>
  getTextDirection(locale);
