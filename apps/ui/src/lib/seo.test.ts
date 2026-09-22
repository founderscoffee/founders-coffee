import { describe, expect, it } from 'vitest';

import { runWithContext } from '@founders-coffee/observability/context';

import { companyPageHead } from './seo-company';
import {
  canonicalPath,
  canonicalUrl,
  cityPageHead,
  localeAlternates,
  marketPageHead,
} from './seo';

describe('canonical URLs', () => {
  it('builds query-free paths for every public route class', () => {
    expect(canonicalPath({ type: 'root' })).toBe('/');
    expect(canonicalPath({ type: 'market', market: 'algeria' })).toBe(
      '/algeria',
    );
    expect(
      canonicalPath({ type: 'city', market: 'algeria', city: 'algiers' }),
    ).toBe('/algeria/algiers');
    expect(
      canonicalPath({
        type: 'event',
        market: 'algeria',
        slug: 'founders-coffee',
      }),
    ).toBe('/algeria/e/founders-coffee');
    expect(
      canonicalPath({ type: 'company', path: '/about/?utm_source=campaign' }),
    ).toBe('/about');
  });

  it('encodes route segments and uses the request origin', () => {
    expect(
      canonicalPath({ type: 'city', market: 'market name', city: 'city/name' }),
    ).toBe('/market%20name/city%2Fname');
    expect(
      runWithContext({ siteOrigin: 'https://staging.founders.coffee' }, () =>
        canonicalUrl({ type: 'event', market: 'algeria', slug: 'meetup' }),
      ),
    ).toBe('https://staging.founders.coffee/algeria/e/meetup');
  });

  it('builds locale-prefixed paths for public routes', () => {
    expect(
      canonicalPath({ type: 'market', market: 'algeria', locale: 'fr' }),
    ).toBe('/fr/algeria');
    expect(
      canonicalPath({
        type: 'city',
        market: 'algeria',
        city: 'algiers',
        locale: 'ar',
      }),
    ).toBe('/ar/algeria/algiers');
    expect(
      canonicalPath({
        type: 'event',
        market: 'algeria',
        slug: 'meetup',
        locale: 'en',
      }),
    ).toBe('/en/algeria/e/meetup');
  });

  it('returns reciprocal localized alternates and a locale-neutral default', () => {
    const alternates = runWithContext(
      { siteOrigin: 'https://founders.coffee' },
      () =>
        localeAlternates({
          type: 'company',
          path: '/about',
          locale: 'ar',
        }),
    );

    expect(alternates).toEqual([
      {
        rel: 'alternate',
        hrefLang: 'ar',
        href: 'https://founders.coffee/ar/about',
      },
      {
        rel: 'alternate',
        hrefLang: 'en',
        href: 'https://founders.coffee/en/about',
      },
      {
        rel: 'alternate',
        hrefLang: 'fr',
        href: 'https://founders.coffee/fr/about',
      },
      {
        rel: 'alternate',
        hrefLang: 'x-default',
        href: 'https://founders.coffee/about',
      },
    ]);
  });
});
describe('public page metadata', () => {
  it('uses localized market copy and emits a complete shared metadata set', () => {
    const head = runWithContext({ siteOrigin: 'https://founders.coffee' }, () =>
      marketPageHead({
        locale: 'en',
        marketName: 'Algeria',
        events: [
          {
            name: 'Founders breakfast',
            url: 'https://founders.coffee/en/algeria/e/founders-breakfast',
          },
        ],
        route: { type: 'market', market: 'algeria', locale: 'en' },
      }),
    );

    expect(head.meta).toEqual(
      expect.arrayContaining([
        { title: 'Founders Coffee - Algeria' },
        {
          name: 'description',
          content: expect.stringContaining('We bring entrepreneurs together'),
        },
        { property: 'og:url', content: 'https://founders.coffee/en/algeria' },
        {
          property: 'og:image',
          content: 'https://founders.coffee/social/founders-coffee-default.png',
        },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        {
          name: 'twitter:image',
          content: 'https://founders.coffee/social/founders-coffee-default.png',
        },
        { name: 'twitter:card', content: 'summary_large_image' },
      ]),
    );
    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: 'https://founders.coffee/en/algeria',
    });
    expect(JSON.parse(head.scripts[0]?.children ?? '{}')).toMatchObject({
      '@type': 'CollectionPage',
      mainEntity: {
        itemListElement: [{ name: 'Founders breakfast', position: 1 }],
      },
    });
  });

  it('changes city descriptions with event availability and keeps empty cities noindex', () => {
    const empty = cityPageHead({
      locale: 'ar',
      marketName: 'الجزائر',
      cityName: 'وهران',
      isEmpty: true,
      route: { type: 'city', market: 'algeria', city: 'oran', locale: 'ar' },
    });
    const active = cityPageHead({
      locale: 'ar',
      marketName: 'الجزائر',
      cityName: 'وهران',
      isEmpty: false,
      route: { type: 'city', market: 'algeria', city: 'oran', locale: 'ar' },
    });

    expect(empty.meta).toContainEqual({
      name: 'robots',
      content: 'noindex,follow',
    });
    expect(active.meta).toContainEqual({
      name: 'robots',
      content: 'index,follow',
    });
    expect(
      empty.meta.find((item) => item.name === 'description')?.content,
    ).not.toBe(
      active.meta.find((item) => item.name === 'description')?.content,
    );
    expect(JSON.parse(active.scripts[0]?.children ?? '{}')).toMatchObject({
      '@type': 'CollectionPage',
    });
    expect(JSON.parse(active.scripts[1]?.children ?? '{}')).toMatchObject({
      '@type': 'BreadcrumbList',
    });
    expect(active.meta).toContainEqual({
      property: 'og:image:alt',
      content: expect.stringContaining('مجتمعات'),
    });
  });

  it('uses the same builder for company pages', () => {
    const head = runWithContext({ siteOrigin: 'https://founders.coffee' }, () =>
      companyPageHead({
        locale: 'en',
        path: '/about',
        title: 'About Founders Coffee',
        description: '  A company page\nwith stable copy.  ',
      }),
    );
    expect(head.meta).toContainEqual({
      name: 'description',
      content: 'A company page with stable copy.',
    });
    expect(head.meta).toContainEqual({
      property: 'og:locale:alternate',
      content: 'ar_DZ',
    });
    expect(head.meta).toContainEqual({
      name: 'twitter:image',
      content: 'https://founders.coffee/social/founders-coffee-default.png',
    });
    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: 'https://founders.coffee/about',
    });
  });
});
