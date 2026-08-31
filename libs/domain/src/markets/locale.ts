import { type Locale, isLocale } from '@founders-coffee/i18n';

/**
 * Resolve the effective locale for a market (FR-L6): the cookie locale wins when it is a valid
 * locale, otherwise the market's `default_locale`. Locale is *derived* from the market — it is
 * never the lookup key (`ar` maps to both DZ and MA, so locale→market is ambiguous).
 */
export const resolveLocaleFor = (
  defaultLocale: Locale,
  cookieLocale?: string,
): Locale =>
  cookieLocale !== undefined && isLocale(cookieLocale)
    ? cookieLocale
    : defaultLocale;
