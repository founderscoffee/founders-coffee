import { LOCALES } from '@founders-coffee/core/locale';

import { COMPANY_PAGES, type CompanyPageKey } from '../content/company/pages';

export const SITEMAP_LOCALES = LOCALES;

export const SITEMAP_COMPANY_PATHS = (
  Object.keys(COMPANY_PAGES) as CompanyPageKey[]
).sort();

export const sitemapCompanyItems = (): Array<{ readonly path: string }> =>
  SITEMAP_COMPANY_PATHS.flatMap((page) =>
    SITEMAP_LOCALES.map((locale) => ({ path: `/${locale}/${page}` })),
  );
