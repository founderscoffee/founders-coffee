import { describe, expect, it } from 'vitest';

import { runWithContext } from '@founders-coffee/observability/context';

import { companyPageHead, organizationJsonLd } from './seo-company';

const head = (locale: 'ar' | 'fr' | 'en', soleLocale?: 'ar') =>
  runWithContext({ siteOrigin: 'https://founders.coffee' }, () =>
    companyPageHead({
      locale,
      path: '/terms',
      canonicalLocale: locale,
      soleLocale,
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
    const organization = JSON.parse(organizationJsonLd()) as Record<
      string,
      unknown
    >;

    expect(organization).not.toHaveProperty('sameAs');
  });
});

describe('Arabic-only company pages', () => {
  it('points every locale at the Arabic canonical', () => {
    for (const locale of ['ar', 'fr', 'en'] as const) {
      expect(linkHrefs(head(locale, 'ar'), 'canonical')).toEqual([
        'https://founders.coffee/ar/terms',
      ]);
    }
  });

  it('advertises no translation that does not exist', () => {
    const result = head('fr', 'ar');
    const alternates = result.links.filter((link) => link.rel === 'alternate');

    expect(alternates).toHaveLength(2);
    expect(linkHrefs(result, 'alternate', 'ar')).toEqual([
      'https://founders.coffee/ar/terms',
    ]);
    expect(linkHrefs(result, 'alternate', 'x-default')).toEqual([
      'https://founders.coffee/ar/terms',
    ]);
  });

  it('describes the document as Arabic, not as the reader locale', () => {
    const result = head('fr', 'ar');
    const jsonLd = JSON.parse(result.scripts[0].children) as {
      inLanguage: string;
    };

    expect(metaValue(result, 'og:locale')?.content).toBe('ar_DZ');
    expect(jsonLd.inLanguage).toBe('ar');
  });

  it('leaves genuinely localized pages with all three alternates', () => {
    const result = head('fr');

    expect(linkHrefs(result, 'canonical')).toEqual([
      'https://founders.coffee/fr/terms',
    ]);
    expect(
      result.links.filter((link) => link.rel === 'alternate'),
    ).toHaveLength(4);
    expect(metaValue(result, 'og:locale')?.content).toBe('fr_FR');
  });
});
