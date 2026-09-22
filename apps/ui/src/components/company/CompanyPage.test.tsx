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
