import { describe, expect, it } from 'vitest';

import { isSeoPrerenderPath, seoPrerenderPages } from './seo-prerender';

describe('SEO prerender inventory', () => {
  it('derives the stable inventory from sitemap company pages', () => {
    const paths = seoPrerenderPages.map(({ path }) => path);

    expect(paths).toHaveLength(15);
    expect(paths).toContain('/ar/about');
    expect(paths).toContain('/en/faq');
    expect(paths).toContain('/fr/about');
    expect(paths).toContain('/ar/terms');
    expect(paths).toContain('/ar/community');
    expect(paths).toContain('/ar/organizers');
    expect(paths).toContain('/ar/legal');
    expect(paths.some((path) => path.includes('/login'))).toBe(false);
  });

  it('omits the non-canonical locale copies of Arabic-only documents', () => {
    const paths = seoPrerenderPages.map(({ path }) => path);

    for (const page of ['terms', 'privacy', 'cookies']) {
      expect(paths).toContain(`/ar/${page}`);
      expect(paths).not.toContain(`/fr/${page}`);
      expect(paths).not.toContain(`/en/${page}`);
    }
  });

  it('filters discovered links to the explicit indexable inventory', () => {
    expect(isSeoPrerenderPath({ path: '/ar/about' })).toBe(true);
    expect(isSeoPrerenderPath({ path: '/ar/about?utm_source=ci' })).toBe(false);
    expect(isSeoPrerenderPath({ path: '/ar/algeria' })).toBe(false);
    expect(isSeoPrerenderPath({ path: '/login' })).toBe(false);
  });
});
