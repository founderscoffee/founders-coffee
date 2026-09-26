import type { CompanyBlock, CompanyPageContent, CompanySection } from './types';

export const text = (...items: readonly string[]): readonly CompanyBlock[] =>
  items.map((value) => ({ kind: 'text', text: value }));

export const note = (value: string): CompanyBlock => ({
  kind: 'note',
  text: value,
});

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
