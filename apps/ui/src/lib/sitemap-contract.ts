import { LOCALES } from '@founders-coffee/core/locale';

import {
  COMPANY_PAGES,
  LEGAL_PAGE_KEYS,
  type CompanyPageKey,
} from '../content/company/pages';

export const SITEMAP_LOCALES = LOCALES;

export const SITEMAP_COMPANY_PATHS = (
  Object.keys(COMPANY_PAGES) as CompanyPageKey[]
).sort();

const ARABIC_ONLY_PATHS = new Set<string>(LEGAL_PAGE_KEYS);

/**
 * Canonical company URLs only. The Arabic-only legal documents serve identical
 * bytes under every locale prefix, so listing all three would put two
 * non-canonical duplicates of each in the sitemap.
 */
export const sitemapCompanyItems = (): Array<{ readonly path: string }> =>
  SITEMAP_COMPANY_PATHS.flatMap((page) =>
    ARABIC_ONLY_PATHS.has(page)
      ? [{ path: `/ar/${page}` }]
      : SITEMAP_LOCALES.map((locale) => ({ path: `/${locale}/${page}` })),
  );
