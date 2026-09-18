export type CompanyTable = {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
};

export type CompanyBlock =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'subheading'; readonly text: string }
  | { readonly kind: 'note'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | ({ readonly kind: 'table' } & CompanyTable);

export type CompanySection = {
  readonly heading: string;
  readonly blocks: readonly CompanyBlock[];
};

export type CompanyPageContent = {
  readonly title: string;
  readonly description: string;
  readonly updated: string;
  readonly sections: readonly CompanySection[];
};

/** Wrap plain paragraphs as text blocks, for pages that need no richer structure. */
export const textBlocks = (
  ...items: readonly string[]
): readonly CompanyBlock[] => items.map((text) => ({ kind: 'text', text }));

export type RelatedKey =
  'privacy' | 'terms' | 'cookies' | 'community' | 'organizers' | 'legal';
