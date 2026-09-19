import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LOCALES } from '@founders-coffee/i18n';

import { SkipLink } from './SkipLink';

const TARGET = '#main-content';

const rootDocument = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../routes/__root.tsx'),
  'utf8',
);

const mainTag = /<main[^>]*>/u.exec(rootDocument)?.[0] ?? '';

afterEach(cleanup);

describe('SkipLink', () => {
  it('points a keyboard user at the main landmark in every locale', () => {
    for (const locale of LOCALES) {
      render(<SkipLink locale={locale} />);
      const link = screen.getByRole('link');

      expect(link.getAttribute('href')).toBe(TARGET);
      expect(link.textContent?.trim(), `${locale} has no label`).not.toBe('');
      cleanup();
    }
  });

  it('names a target the root document actually gives the main landmark', () => {
    expect(mainTag).toContain(`id="${TARGET.slice(1)}"`);
  });

  it('skips to a landmark the root document made focusable, not merely scrollable', () => {
    expect(
      mainTag,
      'without a tabindex the jump scrolls but leaves focus behind, so the next Tab walks the header again',
    ).toContain('tabIndex={-1}');
  });
});
