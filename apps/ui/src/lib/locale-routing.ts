import { isLocale, type Locale } from '@founders-coffee/i18n';

/**
 * The same page, read in another language.
 *
 * A locale prefix is not a route segment of its own here. `/ar/algeria` and `/algeria/algiers`
 * are the same two-parameter route, told apart by whether the first parameter parses as a locale,
 * and the prefix wins over the stored preference whenever it is present — which is right, because
 * a link someone shares has to open in the language it was written in.
 *
 * That is also why switching language cannot be a cookie alone: on a prefixed URL the cookie is
 * read and then ignored, so the page reloads in the language the reader just asked to leave. The
 * prefix has to be rewritten. Paths that carry no prefix — `/login`, `/algeria/host/create` — have
 * no prefixed form to rewrite to, and those do settle from the cookie, so they are left as they
 * are.
 */
export const withLocale = (pathname: string, locale: Locale): string => {
  const [, first, ...rest] = pathname.split('/');
  return isLocale(first) ? ['', locale, ...rest].join('/') : pathname;
};

/**
 * A market or company landing page, addressed in the reader's language.
 *
 * Both sit in the same route: the locale goes in the `market` parameter and the destination — a
 * market slug like `algeria`, or a company page key like `terms` — in `city`. Linking this way
 * rather than to the bare `/algeria` or `/terms` is what keeps the reader out of a redirect, since
 * every unprefixed path answers 307 to its prefixed form before it renders anything.
 */
export const localizedLanding = (locale: Locale, key: string) => ({
  to: '/$market/$city' as const,
  params: { market: locale, city: key },
});

/**
 * An event page, addressed in the reader's language.
 *
 * The unprefixed `/$market/e/$slug` route still exists and still works; it is the form an
 * unprefixed inbound link arrives on, and it answers 307 to this one.
 */
export const localizedEvent = (
  locale: Locale,
  marketSlug: string,
  slug: string,
) => ({
  to: '/$market/$city/e/$slug' as const,
  params: { market: locale, city: marketSlug, slug },
});
