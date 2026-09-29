import type { Locale } from '@founders-coffee/i18n';

import { COMPANY_PAGES, companyPageContent } from './pages';
import type { CompanyPageKey } from './pages';
import type { CompanyBlock } from './types';

export const KEYS = Object.keys(COMPANY_PAGES) as CompanyPageKey[];

const blockText = (block: CompanyBlock): string[] => {
  if (block.kind === 'table')
    return [...block.columns, ...block.rows.flatMap((row) => [...row])];
  if (block.kind === 'list') return [...block.items];
  return [block.text];
};

export const allText = (key: CompanyPageKey, locale: Locale = 'ar') =>
  companyPageContent(key, locale).sections.flatMap((section) =>
    section.blocks.flatMap(blockText),
  );

export const publishedText = (key: CompanyPageKey, locale: Locale) => {
  const content = companyPageContent(key, locale);
  return [content.title, content.description, ...allText(key, locale)];
};
