import { describe, expect, it } from 'vitest';

import { runWithContext } from '@founders-coffee/observability/context';

import { canonicalPath, canonicalUrl, localeAlternates } from './seo';

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
