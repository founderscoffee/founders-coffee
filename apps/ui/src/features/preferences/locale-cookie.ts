import { cookieName, isLocale, type Locale } from '@founders-coffee/i18n';

const ONE_YEAR_IN_SECONDS = 31_536_000;

/**
 * Write this device's language, which is the value every server render reads back through
 * `detectLocale`.
 *
 * A year, because the alternative to a long life is a reader who chose a language once being asked
 * again by silence. `samesite=lax` rather than `strict` because shared links are this product's
 * main way in, and a strict cookie is withheld on exactly the cross-site navigation whose language
 * is worth remembering.
 *
 * Four call sites wrote this string themselves before it lived here: the toggle, the account
 * preference, the reconciliation that adopts a signed-in member's saved language, and the prefix
 * that `usePathLocale` records. A cookie written four ways is four chances for one of them to drift
 * to a different path or lifetime and quietly stop being the same cookie.
 */
export const storeLocale = (locale: Locale): void => {
  document.cookie = `${cookieName}=${locale}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
};

/**
 * The language a path names outright, or `null` for one that names none.
 *
 * `/fr/algeria` and `/algeria/algiers` are the same two-parameter route, told apart only by whether
 * the first segment parses as a locale. That is the same test the root route makes to decide what
 * to render in, so this must keep making it the same way: a path the root reads as prefixed and
 * this reads as bare would render one language and remember another.
 */
export const localeInPath = (pathname: string): Locale | null => {
  const [first] = pathname.split('/').filter(Boolean);
  return isLocale(first) ? first : null;
};
