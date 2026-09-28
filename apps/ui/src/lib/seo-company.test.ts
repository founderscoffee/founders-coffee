import { describe, expect, it } from 'vitest';

import { runWithContext } from '@founders-coffee/observability/context';

import {
  companyPageHead,
  organizationJsonLd,
  websiteJsonLd,
} from './seo-company';

const head = (locale: 'ar' | 'fr' | 'en') =>
  runWithContext({ siteOrigin: 'https://founders.coffee' }, () =>
    companyPageHead({
      locale,
      path: '/terms',
      canonicalLocale: locale,
      title: 'شروط الاستخدام',
      description: 'الشروط التي تحكم استخدام المنصة.',
    }),
  );

const linkHrefs = (
  result: ReturnType<typeof companyPageHead>,
  rel: string,
  hrefLang?: string,
) =>
  result.links
    .filter(
      (link) =>
        link.rel === rel &&
        (hrefLang === undefined ||
          (link as { hrefLang?: string }).hrefLang === hrefLang),
    )
    .map((link) => link.href);

const metaValue = (
  result: ReturnType<typeof companyPageHead>,
  property: string,
) =>
  result.meta.find(
    (entry) => (entry as { property?: string }).property === property,
  ) as { content?: string } | undefined;

describe('organization structured data', () => {
  it('omits empty authority signals', () => {
    const organization = JSON.parse(organizationJsonLd('en')) as Record<
      string,
      unknown
    >;

    expect(organization).not.toHaveProperty('sameAs');
  });

  it('describes the organization in the language of the page it is on', () => {
    const description = (locale: 'ar' | 'fr' | 'en') =>
      (JSON.parse(organizationJsonLd(locale)) as { description: string })
        .description;

    expect(description('ar')).toContain('رواد الأعمال');
    expect(description('fr')).toContain('entrepreneurs');
    expect(
      description('en'),
      'every locale carried the same English sentence',
    ).toContain('entrepreneur');
    expect(new Set([description('ar'), description('fr')]).size).toBe(2);
  });
});

describe('site name structured data', () => {
  it('names the site as Google should print it, at the root of the domain', () => {
    const website = runWithContext(
      { siteOrigin: 'https://founders.coffee' },
      () => JSON.parse(websiteJsonLd()) as Record<string, unknown>,
    );

    expect(website).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Founders Coffee',
      url: 'https://founders.coffee/',
    });
  });
});

describe('localized company pages', () => {
  it('points every locale at its own canonical', () => {
    for (const locale of ['ar', 'fr', 'en'] as const) {
      expect(linkHrefs(head(locale), 'canonical')).toEqual([
        `https://founders.coffee/${locale}/terms`,
      ]);
    }
  });

  it('advertises every available translation', () => {
    const result = head('fr');
    const alternates = result.links.filter((link) => link.rel === 'alternate');

    expect(alternates).toHaveLength(4);
    expect(linkHrefs(result, 'alternate', 'ar')).toEqual([
      'https://founders.coffee/ar/terms',
    ]);
    expect(linkHrefs(result, 'alternate', 'fr')).toEqual([
      'https://founders.coffee/fr/terms',
    ]);
    expect(linkHrefs(result, 'alternate', 'en')).toEqual([
      'https://founders.coffee/en/terms',
    ]);
    expect(linkHrefs(result, 'alternate', 'x-default')).toEqual([
      'https://founders.coffee/ar/terms',
    ]);
  });

  it('describes each document in its own language', () => {
    const result = head('fr');
    const jsonLd = JSON.parse(result.scripts[0].children) as {
      inLanguage: string;
    };

    expect(metaValue(result, 'og:locale')?.content).toBe('fr_FR');
    expect(jsonLd.inLanguage).toBe('fr');
  });

  it('keeps the Arabic default alternate for all languages', () => {
    const result = head('en');
    expect(linkHrefs(result, 'alternate', 'x-default')).toEqual([
      'https://founders.coffee/ar/terms',
    ]);
    expect(metaValue(result, 'og:locale')?.content).toBe('en_US');
  });
});
