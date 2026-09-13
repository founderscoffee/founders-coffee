import { describe, expect, it } from 'vitest';

import { isSeoPrerenderPath, seoPrerenderPages } from './seo-prerender';

describe('SEO prerender inventory', () => {
  it('derives the stable inventory from sitemap company pages', () => {
    const paths = seoPrerenderPages.map(({ path }) => path);

    expect(paths).toHaveLength(15);
    expect(paths).toContain('/ar/about');
    expect(paths).toContain('/fr/privacy');
    expect(paths).toContain('/en/terms');
    expect(paths.some((path) => path.includes('/login'))).toBe(false);
  });

  it('filters discovered links to the explicit indexable inventory', () => {
    expect(isSeoPrerenderPath({ path: '/ar/about' })).toBe(true);
    expect(isSeoPrerenderPath({ path: '/ar/about?utm_source=ci' })).toBe(false);
    expect(isSeoPrerenderPath({ path: '/ar/algeria' })).toBe(false);
    expect(isSeoPrerenderPath({ path: '/login' })).toBe(false);
  });
});
