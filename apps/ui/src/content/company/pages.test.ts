import { describe, expect, it } from 'vitest';

import { sessionTokenFromCookie } from '@founders-coffee/auth';
import { LOCALES, type Locale } from '@founders-coffee/i18n';

import { SITEMAP_COMPANY_PATHS } from '../../lib/sitemap-contract';

import {
  COMPANY_PAGES,
  LEGAL_PAGE_KEYS,
  companyLinkKey,
  companyPageContent,
  isCompanyPageKey,
} from './pages';
import type { CompanyPageKey, LegalPageKey } from './pages';
import type { CompanyBlock } from './types';

const KEYS = Object.keys(COMPANY_PAGES) as CompanyPageKey[];

const blockText = (block: CompanyBlock): string[] => {
  if (block.kind === 'table')
    return [...block.columns, ...block.rows.flatMap((row) => [...row])];
  if (block.kind === 'list') return [...block.items];
  return [block.text];
};

const allText = (key: CompanyPageKey, locale: Locale = 'ar') =>
  companyPageContent(key, locale).sections.flatMap((section) =>
    section.blocks.flatMap(blockText),
  );

const criticalLegalFacts: Partial<Record<LegalPageKey, readonly string[]>> = {
  terms: ['19', '03-05', 'contact@founders.coffee'],
  privacy: [
    '18-07',
    '25-11',
    '19',
    '30',
    '90',
    '24',
    '12',
    '10',
    '40',
    '43',
    '44',
    '45',
    'Cloudflare',
    'Mapbox',
    'contact@founders.coffee',
  ],
  cookies: [
    '__Secure-better-auth.session_token',
    'PARAGLIDE_LOCALE',
    'fc_geo',
    'cf_clearance',
    'Cloudflare',
    'Mapbox',
    'contact@founders.coffee',
  ],
  community: ['contact@founders.coffee'],
  organizers: ['18-07', 'contact@founders.coffee'],
  legal: ['03-05', '18-07', 'contact@founders.coffee'],
};

describe('company pages', () => {
  it('resolves content for every page in every locale', () => {
    for (const key of KEYS) {
      for (const locale of LOCALES) {
        const content = companyPageContent(key, locale);
        expect(content.title.length).toBeGreaterThan(0);
        expect(content.description.length).toBeGreaterThan(0);
        expect(content.sections.length).toBeGreaterThan(0);
      }
    }
  });

  it('serves a translated legal document for every locale', () => {
    for (const key of LEGAL_PAGE_KEYS) {
      const arabic = companyPageContent(key, 'ar');
      for (const locale of LOCALES) {
        const content = companyPageContent(key, locale);
        expect(content.sections).toHaveLength(arabic.sections.length);
        expect(content.title.length).toBeGreaterThan(0);
        expect(content.description.length).toBeGreaterThan(0);
        if (locale !== 'ar') {
          expect(content.title).not.toMatch(/[\u0600-\u06ff]/u);
          expect(allText(key, locale).join(' ')).not.toMatch(
            /[\u0600-\u06ff]/u,
          );
        }
      }
    }
  });

  it('states the Arabic authority for every translated legal document', () => {
    for (const key of LEGAL_PAGE_KEYS) {
      expect(companyPageContent(key, 'ar').notice).toBeUndefined();
      for (const locale of ['en', 'fr'] as const) {
        expect(
          companyPageContent(key, locale).notice,
          `${key}:${locale} renders the authority note in its header, under the date; as the first block of the first section it sat below the table of contents, where a reader meets it last`,
        ).toMatch(
          locale === 'en'
            ? /Arabic version is authoritative/u
            : /version arabe fait foi/u,
        );
      }
    }
  });

  it('cites the Terms clause that moves the agreement to a company', () => {
    const companyClause: Record<Locale, string> = {
      ar: 'إن تأسّست الشركة',
      en: 'If a company is incorporated',
      fr: 'Si une société est créée',
    };
    const citation: Record<Locale, RegExp> = {
      ar: /البند (\d+) من/u,
      en: /section (\d+) of/u,
      fr: /section (\d+) des/u,
    };

    for (const locale of LOCALES) {
      const cited = allText('legal', locale)
        .join(' ')
        .match(citation[locale])?.[1];
      const clause = companyPageContent('terms', locale).sections[
        Number(cited) - 1
      ];

      expect(
        clause?.heading,
        `legal:${locale} sends readers to Terms clause ${cited ?? '(none)'}, which the Terms number from 1 in their table of contents`,
      ).toBe(companyClause[locale]);
    }
  });

  it('ends every list item of a legal document where its sentence ends', () => {
    for (const key of LEGAL_PAGE_KEYS) {
      for (const locale of LOCALES) {
        const items = companyPageContent(key, locale).sections.flatMap(
          (section) =>
            section.blocks.flatMap((block) =>
              block.kind === 'list' ? [...block.items] : [],
            ),
        );
        for (const item of items) {
          expect(
            item,
            `${key}:${locale} has a bullet that stops mid-sentence, so the rest of its sentence is rendered as a separate paragraph`,
          ).toMatch(/[.;:؛]\**$/u);
        }
      }
    }
  });

  it('keeps critical legal facts present in every translation', () => {
    for (const key of LEGAL_PAGE_KEYS) {
      const facts = criticalLegalFacts[key] ?? [];
      for (const locale of LOCALES) {
        const publishedText = [
          companyPageContent(key, locale).title,
          companyPageContent(key, locale).description,
          ...allText(key, locale),
        ].join(' ');
        for (const fact of facts) {
          expect(
            publishedText,
            `${key}:${locale} is missing ${fact}`,
          ).toContain(fact);
        }
      }
    }
  });

  it('anchors the reporting section the same way in every locale', () => {
    for (const locale of LOCALES) {
      const sections = companyPageContent('contact', locale).sections;
      expect(
        sections.filter((section) => section.anchor === 'report').length,
        `contact:${locale} has no section anchored at #report, and the footer link points there — a generated id is built from the translated heading, so it differs per locale and shifts when a section is inserted above it`,
      ).toBe(1);
    }
  });

  it('only links to company pages that exist', () => {
    const links = LOCALES.flatMap((locale) =>
      KEYS.flatMap((key) => allText(key, locale)),
    ).flatMap((text) => [...text.matchAll(/\]\((\/[^)]+)\)/g)]);

    expect(links.length).toBeGreaterThan(0);
    for (const [, href] of links) {
      expect(
        companyLinkKey(href),
        `${href} is linked in the published text but the renderer cannot place it, so a reader would be shown the raw markdown`,
      ).not.toBeNull();
    }
  });

  it('links exactly the pages the router recognises', () => {
    for (const key of KEYS) {
      expect(isCompanyPageKey(key)).toBe(true);
      expect(
        companyLinkKey(`/${key}`),
        `/${key} routes through $locale/$market but the renderer will not link it`,
      ).toBe(key);
    }

    expect(companyLinkKey('/not-a-company-page')).toBeNull();
  });

  it('leaves no unresolved bracket placeholders in published text', () => {
    for (const key of KEYS) {
      for (const text of allText(key)) {
        expect(text.replace(/\[[^\]]+\]\(\/[^)]+\)/g, '')).not.toMatch(/\[/);
      }
    }
  });

  it('never publishes an internal editorial note', () => {
    for (const key of KEYS) {
      for (const text of allText(key)) {
        expect(text).not.toContain('تُحذف قبل النشر');
      }
    }
  });

  it('lists every legal document as a routed legal page', () => {
    expect([...LEGAL_PAGE_KEYS].sort()).toEqual([
      'community',
      'cookies',
      'legal',
      'organizers',
      'privacy',
      'terms',
    ]);
    expect(LEGAL_PAGE_KEYS).toContain('community');
    expect(LEGAL_PAGE_KEYS).toContain('organizers');
    expect(LEGAL_PAGE_KEYS).toContain('legal');
  });

  it('names the session cookie by the name the app reads it under', () => {
    const listed = companyPageContent('cookies', 'ar').sections.flatMap(
      (section) =>
        section.blocks.flatMap((block) =>
          block.kind === 'table'
            ? block.rows.map(([name = '']) => name.replaceAll('`', ''))
            : [],
        ),
    );

    expect(listed.length).toBeGreaterThan(0);
    expect(
      listed.filter((name) => sessionTokenFromCookie(`${name}=tok.sig`)),
      'the cookie policy lists a session cookie no browser holds: Better Auth sets __Secure-better-auth.session_token, the one name the app reads',
    ).toHaveLength(1);
  });

  it('exposes every company page to crawlers', () => {
    for (const key of KEYS) {
      expect(SITEMAP_COMPANY_PATHS).toContain(key);
    }
  });

  it('every section carries at least one block', () => {
    for (const key of KEYS) {
      for (const section of companyPageContent(key, 'ar').sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.blocks.length).toBeGreaterThan(0);
      }
    }
  });
});
