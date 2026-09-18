const LOCALES = ['ar', 'fr', 'en'];

/**
 * The pages served from the company registry rather than from a market.
 *
 * `/fr/terms` and `/fr/algeria` are both two segments deep, so nothing in the path tells a
 * company page from a market landing page; this list is what does. `apps/ui` holds the same
 * names in its own registry and a test there fails when the two drift, because a company page
 * added there and not here was read as a market and asked for a market's structured data.
 */
export const COMPANY_PAGES = [
  'about',
  'community',
  'contact',
  'cookies',
  'faq',
  'legal',
  'organizers',
  'privacy',
  'terms',
];

/** Which contract a path answers to, or null when the smoke does not cover it. */
export const classifyPath = (path) => {
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2 || !LOCALES.includes(segments[0])) return null;
  if (COMPANY_PAGES.includes(segments[1])) return 'company';
  if (segments[1] === 'host' && segments[2] === 'create') return 'utility';
  if (segments.length === 2) return 'market';
  if (segments[2] === 'e' && segments.length === 4) return 'event';
  if (segments.length === 3) return 'city';
  if (segments[2] === 'host' && segments.length === 4) return 'utility';
  if (segments.length === 4 && segments[3] === 'host') return 'utility';
  return null;
};

/**
 * The one language a document says it is written in, or null when it is published in several.
 *
 * A document that exists in a single language is still served at all three addresses, and every
 * one of them points at that language: one `hreflang` alternate, an `x-default` beside it, and a
 * canonical that leaves the address it was fetched from. That is consolidation rather than a
 * mismatch, and the alternative the pages rejected: three self-canonical copies of the same
 * Arabic bytes compete with one another instead of pooling into one result.
 *
 * Read off the document rather than from a list of which pages those are, so that the canonical,
 * the `x-default` and the JSON-LD `inLanguage` are checked against what the page itself claims.
 */
export const soleAlternateLocale = (body) => {
  const locales = new Set();
  for (const [tag] of body.matchAll(
    /<link\b(?=[^>]*\brel=["']alternate["'])[^>]*>/giu,
  )) {
    const locale = tag.match(/hreflang=["']([^"']+)["']/iu)?.[1]?.toLowerCase();
    if (locale && LOCALES.includes(locale)) locales.add(locale);
  }
  return locales.size === 1 ? [...locales][0] : null;
};

/** The same path read in another language. */
export const withLocale = (path, locale) => {
  const [, first, ...rest] = path.split('/');
  return LOCALES.includes(first) ? ['', locale, ...rest].join('/') : path;
};

/** Where a document's `x-default` points, which a consolidated document aims at one language. */
export const defaultAlternateHref = (body) => {
  for (const [tag] of body.matchAll(
    /<link\b(?=[^>]*\brel=["']alternate["'])[^>]*>/giu,
  )) {
    if (/hreflang=["']x-default["']/iu.test(tag))
      return tag.match(/href=["']([^"']+)["']/iu)?.[1] ?? null;
  }
  return null;
};
