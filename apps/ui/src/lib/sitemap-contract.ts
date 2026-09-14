export const SITEMAP_LOCALES = ['ar', 'fr', 'en'] as const;

export const SITEMAP_COMPANY_PATHS = [
  'about',
  'contact',
  'cookies',
  'privacy',
  'terms',
] as const;

export const sitemapCompanyItems = (): Array<{ readonly path: string }> =>
  SITEMAP_COMPANY_PATHS.flatMap((page) =>
    SITEMAP_LOCALES.map((locale) => ({ path: `/${locale}/${page}` })),
  );
