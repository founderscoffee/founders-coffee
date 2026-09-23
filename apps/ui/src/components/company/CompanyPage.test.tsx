import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import type { CompanyPageContent } from '../../content/company';
import { CompanyPage } from './CompanyPage';

const page = (
  sections: CompanyPageContent['sections'],
): CompanyPageContent => ({
  title: 'Contact',
  description: 'How to reach us.',
  updated: '22 September 2026',
  sections,
});

const show = (content: CompanyPageContent) =>
  render(<CompanyPage locale="en" content={content} related={[]} />).container;

afterEach(cleanup);

describe('where a company section can be linked to', () => {
  it('uses the anchor a section declares', () => {
    const container = show(
      page([
        {
          heading: 'Report a problem',
          anchor: 'report',
          blocks: [{ kind: 'text', text: 'Email us.' }],
        },
      ]),
    );

    expect(
      container.querySelector('#report'),
      'the footer links to /contact#report, and the id generated from a heading is built from the translated text, so it is a different fragment in each locale and a different one again the moment a section is inserted above it',
    ).toBeTruthy();
  });

  it('still numbers a section that declares none', () => {
    const container = show(
      page([
        {
          heading: 'General support',
          blocks: [{ kind: 'text', text: 'Email us.' }],
        },
      ]),
    );

    expect(container.querySelector('#report')).toBeNull();
    expect(container.querySelector('section')?.getAttribute('id')).toBe(
      's-0-general-support',
    );
  });

  it('keeps the table of contents pointing at the same fragments', () => {
    const container = show(
      page(
        ['Report a problem', 'General support', 'Privacy', 'Partnerships'].map(
          (heading, index) => ({
            heading,
            ...(index === 0 ? { anchor: 'report' } : {}),
            blocks: [{ kind: 'text' as const, text: 'Email us.' }],
          }),
        ),
      ),
    );

    const targets = Array.from(container.querySelectorAll('nav a')).map(
      (link) => link.getAttribute('href'),
    );

    expect(
      targets,
      'the contents list is generated from the same ids as the sections, so an anchor that only reached one of the two would scroll nowhere',
    ).toContain('#report');
  });
});

const TAILWIND_REM = {
  'max-w-xs': 20,
  'max-w-sm': 24,
  'max-w-md': 28,
  'max-w-lg': 32,
  'max-w-xl': 36,
  'max-w-2xl': 42,
  'max-w-3xl': 48,
  'max-w-4xl': 56,
  'max-w-5xl': 64,
};
const ROOT_FONT_PX = 16;
const ARABIC_CHARACTER_PX = 7.75;
const COMFORTABLE = { fewest: 45, most: 75 };

const readingColumn = (): { width: number; gutter: number } => {
  const article = show(page([])).querySelector('article');
  const classes = (article?.getAttribute('class') ?? '').split(/\s+/u);
  const cap = classes.find((name) => name in TAILWIND_REM);
  const declared = /^px-(\d+)$/u.exec(
    classes.find((name) => /^px-\d+$/u.test(name)) ?? '',
  );
  const gutter = declared ? Number(declared[1]) * 4 : 0;
  return {
    width:
      TAILWIND_REM[cap as keyof typeof TAILWIND_REM] * ROOT_FONT_PX -
      gutter * 2,
    gutter,
  };
};

describe('how far the eye travels along a line of a legal page', () => {
  it('keeps a line inside the band a reader can sweep back across', () => {
    const characters = readingColumn().width / ARABIC_CHARACTER_PX;

    expect(
      characters,
      'measured on /ar/terms at 1440px: Tajawal 16px averages 7.75px a character, and a 736px column put roughly 95 of them on a line, where the eye loses its place coming back',
    ).toBeLessThanOrEqual(COMFORTABLE.most);
    expect(characters).toBeGreaterThanOrEqual(COMFORTABLE.fewest);
  });

  it('keeps the words off the edge of a phone', () => {
    expect(
      readingColumn().gutter,
      'below the cap the viewport is what sets the column, and with no gutter the text runs into the bezel',
    ).toBeGreaterThan(0);
  });
});
