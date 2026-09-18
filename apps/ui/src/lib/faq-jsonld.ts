import type { CompanyPageContent } from '../content/company';

type FaqEntry = {
  readonly question: string;
  answer: string[];
};

const plainText = (value: string): string =>
  value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');

/**
 * Pair every question subheading with the answer paragraphs that follow it.
 *
 * Pairing restarts at each section so a stray leading paragraph is never
 * appended to the previous section's last answer.
 */
export const faqEntries = (
  content: CompanyPageContent,
): readonly FaqEntry[] => {
  const entries: FaqEntry[] = [];
  for (const section of content.sections) {
    let open: FaqEntry | undefined;
    for (const block of section.blocks) {
      if (block.kind === 'subheading') {
        open = { question: plainText(block.text), answer: [] };
        entries.push(open);
      } else if (open && block.kind === 'text') {
        open.answer.push(plainText(block.text));
      }
    }
  }
  return entries.filter((entry) => entry.answer.length > 0);
};

/** FAQPage structured data for a question-and-answer company page. */
export const faqJsonLd = (content: CompanyPageContent, url: string): string =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url,
    mainEntity: faqEntries(content).map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer.join(' '),
      },
    })),
  });
