import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { cn } from './cn.js';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const THEME_TYPE_SIZES = [
  ...new Set(
    [...styles.matchAll(/--text-([a-z0-9-]+):/g)]
      .map(([, name]) => name)
      .filter((name) => !name.includes('--')),
  ),
];

describe('cn', () => {
  it('reads the type scale out of the theme', () => {
    expect(THEME_TYPE_SIZES).toContain('body-sm');
    expect(THEME_TYPE_SIZES).toContain('caption');
  });

  it.each(THEME_TYPE_SIZES)('keeps text-%s beside a text colour', (size) => {
    expect(
      cn(`text-${size}`, 'text-neutral'),
      `text-${size} is a size in the theme, and tailwind-merge took it for a colour: the class that sets the size was dropped`,
    ).toBe(`text-${size} text-neutral`);
  });

  it('lets a later type size replace an earlier one', () => {
    expect(cn('text-body-sm text-neutral', 'text-caption')).toBe(
      'text-neutral text-caption',
    );
  });

  it('still lets a later colour replace an earlier one', () => {
    expect(cn('text-body-sm text-neutral', 'text-error')).toBe(
      'text-body-sm text-error',
    );
  });
});
