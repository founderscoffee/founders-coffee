import { describe, expect, it } from 'vitest';

import { LEGAL_PAGE_KEYS } from '../content/company/pages';

import { isSeoPrerenderPath, seoPrerenderPages } from './seo-prerender';

describe('SEO prerender inventory', () => {
  it('derives the stable inventory from sitemap company pages', () => {
    const paths = seoPrerenderPages.map(({ path }) => path);

    expect(paths).toHaveLength(27);
    expect(paths).toContain('/ar/about');
    expect(paths).toContain('/en/faq');
    expect(paths).toContain('/fr/about');
    expect(paths).toContain('/ar/terms');
    expect(paths).toContain('/ar/community');
    expect(paths).toContain('/ar/organizers');
    expect(paths).toContain('/ar/legal');
    expect(paths.some((path) => path.includes('/login'))).toBe(false);
  });

  it('includes every translated legal document in every locale', () => {
    const paths = seoPrerenderPages.map(({ path }) => path);

    for (const page of LEGAL_PAGE_KEYS)
      for (const locale of ['ar', 'fr', 'en'])
        expect(paths).toContain(`/${locale}/${page}`);
  });

  it('filters discovered links to the explicit indexable inventory', () => {
    expect(isSeoPrerenderPath({ path: '/ar/about' })).toBe(true);
    expect(isSeoPrerenderPath({ path: '/ar/about?utm_source=ci' })).toBe(false);
    expect(isSeoPrerenderPath({ path: '/ar/algeria' })).toBe(false);
    expect(isSeoPrerenderPath({ path: '/login' })).toBe(false);
  });
});
