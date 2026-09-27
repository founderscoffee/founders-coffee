import type { CompanyBlock, CompanyPageContent, CompanySection } from './types';

export const text = (...items: readonly string[]): readonly CompanyBlock[] =>
  items.map((value) => ({ kind: 'text', text: value }));

export const subheading = (value: string): CompanyBlock => ({
  kind: 'subheading',
  text: value,
});

export const list = (items: readonly string[]): CompanyBlock => ({
  kind: 'list',
  items,
});

export const table = (
  columns: readonly string[],
  rows: readonly (readonly string[])[],
): CompanyBlock => ({ kind: 'table', columns, rows });

export const section = (
  heading: string,
  blocks: readonly CompanyBlock[],
): CompanySection => ({ heading, blocks });

export const page = (
  title: string,
  description: string,
  sections: readonly CompanySection[],
  updated = '18 September 2026',
): CompanyPageContent => ({
  title,
  description,
  updated,
  sections,
});

export const translatedPage = (
  locale: 'en' | 'fr',
  title: string,
  description: string,
  sections: readonly CompanySection[],
  updated = '18 September 2026',
): CompanyPageContent => ({
  ...page(title, description, sections, updated),
  notice:
    locale === 'en'
      ? 'This is an English translation for convenience. If it differs from the Arabic version, the Arabic version is authoritative.'
      : 'Cette page est une traduction française fournie pour faciliter votre lecture. En cas de divergence avec la version arabe, la version arabe fait foi.',
});
