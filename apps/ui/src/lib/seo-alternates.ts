import { baseLocale, isLocale, type Locale } from '@founders-coffee/i18n';

/**
 * The language to answer a reader whose own matches none of the published ones.
 *
 * `x-default` used to name the prefix-free address — `/algeria/algiers` beside the three prefixed
 * alternates — which was the neutral thing to say and a redirect to say it. Every unprefixed public
 * address answers 307 to its prefixed form, and an `hreflang` target that redirects is one a
 * crawler is told not to follow; it is also the one address of the set that is in no sitemap and is
 * canonical to nothing.
 *
 * The base locale is what that address resolves to for a reader carrying no preference, so naming
 * it outright says the same thing and answers 200. A page published in one language only names that
 * language instead, the base locale having no copy of it to point at.
 */
export const xDefaultLocale = (locales: readonly Locale[]): Locale =>
  locales.includes(baseLocale) ? baseLocale : (locales[0] ?? baseLocale);

/**
 * The Open Graph name for a locale, which names a country as well as a language.
 *
 * A page that belongs to a market names that market's country: the Arabic page for Egypt is
 * `ar_EG`, where every Arabic page used to say `ar_DZ` and so told link previews that Egypt's and
 * Saudi Arabia's pages were Algerian. A page that belongs to no market keeps the country each
 * language has always named.
 */
export const openGraphLocale = (locale: Locale, marketCode?: string): string =>
  marketCode
    ? `${locale}_${marketCode}`
    : locale === 'ar'
      ? 'ar_DZ'
      : locale === 'fr'
        ? 'fr_FR'
        : 'en_US';

type HeadLink = {
  readonly rel?: string;
  readonly hrefLang?: string;
};

/**
 * The page's `og:locale:alternate` values: one for each language its hreflang links name, other
 * than the language it is in.
 *
 * They cannot travel with the rest of the page's Open Graph tags. `HeadContent` keeps one meta tag
 * per `property`, so of the two alternates every page declared, only the last one reached the
 * document (#117). The hreflang links name the same languages and arrive whole, because links are
 * not merged by attribute, so the root document reads the alternates off them and writes the tags
 * itself.
 *
 * Only the links that name a bare language count. A market's landing page also names each language
 * country by country, and those would list every market's copy rather than this page's own. On a
 * page that belongs to a market, each alternate names that market's country, as `og:locale` does.
 */
export const openGraphAlternates = (
  links: readonly (HeadLink | undefined)[],
  locale: Locale,
  marketCode?: string,
): string[] =>
  links.flatMap((link) =>
    link?.rel === 'alternate' &&
    isLocale(link.hrefLang) &&
    link.hrefLang !== locale
      ? [openGraphLocale(link.hrefLang, marketCode)]
      : [],
  );
