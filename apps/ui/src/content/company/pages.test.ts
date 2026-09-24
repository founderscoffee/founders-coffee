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
import type { CompanyPageKey } from './pages';
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

  it('serves the Arabic text for legal pages in every locale', () => {
    for (const key of KEYS) {
      const entry = COMPANY_PAGES[key];
      if (entry.kind !== 'arabic') continue;
      for (const locale of LOCALES) {
        expect(companyPageContent(key, locale)).toBe(entry.content);
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

  it('lists every Arabic legal document as a routed legal page', () => {
    const arabic = KEYS.filter((key) => COMPANY_PAGES[key].kind === 'arabic');

    expect([...LEGAL_PAGE_KEYS].sort()).toEqual([...arabic].sort());
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
