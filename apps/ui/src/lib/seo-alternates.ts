import { baseLocale, type Locale } from '@founders-coffee/i18n';

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
