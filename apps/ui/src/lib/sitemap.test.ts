import { describe, expect, it } from 'vitest';

import type { SitemapData } from '@founders-coffee/server-fns';

import { emptySitemapXml, sitemapItems, sitemapXml } from './sitemap';

const data: SitemapData = {
  markets: [{ slug: 'algeria' }],
  cities: [{ market: 'algeria', city: 'algiers' }],
  events: [
    {
      market: 'algeria',
      slug: 'coffee-and-code',
      updatedAt: new Date('2026-09-13T08:00:00.000Z'),
    },
  ],
};

describe('sitemap', () => {
  it('emits localized canonical public paths without duplicates', () => {
    const items = sitemapItems(data);
    const paths = items.map(({ path }) => path);

    expect(paths).toHaveLength(24);
    expect(paths).toContain('/ar/algeria');
    expect(paths).toContain('/fr/algeria/algiers');
    expect(paths).toContain('/en/algeria/e/coffee-and-code');
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('renders escaped absolute XML locations and event last-modified values', () => {
    const xml = sitemapXml('https://founders.coffee/', sitemapItems(data));

    expect(xml).toContain(
      '<loc>https://founders.coffee/en/algeria/e/coffee-and-code</loc>',
    );
    expect(xml).toContain('<lastmod>2026-09-13T08:00:00.000Z</lastmod>');
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
  });

  it('returns an empty valid sitemap for non-production origins', () => {
    expect(emptySitemapXml('https://staging.founders.coffee')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n</urlset>',
    );
  });
});
