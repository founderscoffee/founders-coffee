import { describe, expect, it } from 'vitest';

import { LOCALES } from '@founders-coffee/i18n';

import { companyPageContent } from '../content/company';

import { faqEntries, faqJsonLd } from './faq-jsonld';

const content = (locale: 'ar' | 'fr' | 'en') =>
  companyPageContent('faq', locale);

describe('FAQ structured data', () => {
  it('pairs every question with an answer in every locale', () => {
    for (const locale of LOCALES) {
      const page = content(locale);
      const questions = page.sections.flatMap((section) =>
        section.blocks.filter((block) => block.kind === 'subheading'),
      );

      expect(questions.length).toBeGreaterThanOrEqual(10);
      expect(faqEntries(page)).toHaveLength(questions.length);
      for (const entry of faqEntries(page)) {
        expect(entry.question.length).toBeGreaterThan(0);
        expect(entry.answer.join(' ').length).toBeGreaterThan(0);
      }
    }
  });

  it('never leaks link or emphasis markup into the answer text', () => {
    for (const locale of LOCALES) {
      for (const entry of faqEntries(content(locale))) {
        const text = `${entry.question} ${entry.answer.join(' ')}`;
        expect(text).not.toMatch(/\*\*|\]\(|`/);
      }
    }
  });

  it('restarts pairing at each section', () => {
    const entries = faqEntries({
      title: 'x',
      description: 'x',
      updated: 'x',
      sections: [
        {
          heading: 'one',
          blocks: [
            { kind: 'subheading', text: 'First question?' },
            { kind: 'text', text: 'First answer.' },
          ],
        },
        {
          heading: 'two',
          blocks: [
            { kind: 'text', text: 'Stray lead paragraph.' },
            { kind: 'subheading', text: 'Second question?' },
            { kind: 'text', text: 'Second answer.' },
          ],
        },
      ],
    });

    expect(entries).toEqual([
      { question: 'First question?', answer: ['First answer.'] },
      { question: 'Second question?', answer: ['Second answer.'] },
    ]);
  });

  it('emits a FAQPage node carrying every question', () => {
    const page = content('ar');
    const jsonLd = JSON.parse(
      faqJsonLd(page, 'https://founders.coffee/ar/faq'),
    ) as {
      '@type': string;
      url: string;
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };

    expect(jsonLd['@type']).toBe('FAQPage');
    expect(jsonLd.url).toBe('https://founders.coffee/ar/faq');
    expect(jsonLd.mainEntity).toHaveLength(faqEntries(page).length);
    expect(jsonLd.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(0);
  });
});
