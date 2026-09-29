import { describe, expect, it } from 'vitest';

import { buildPageTitle } from './seo';

describe('page titles', () => {
  it('puts the brand in front of a page that does not name it', () => {
    expect(buildPageTitle('Algeria')).toBe('Founders Coffee - Algeria');
    expect(buildPageTitle('من نحن')).toBe('Founders Coffee - من نحن');
  });

  it.each([
    'À propos de Founders Coffee',
    'About Founders Coffee',
    'Founders Coffee operations',
    'إدارة Founders Coffee',
  ])('keeps "%s" whole, since it names the brand already', (title) => {
    expect(
      buildPageTitle(title),
      'the brand used to be cut out and put back in front, which left "Founders Coffee - À propos de"',
    ).toBe(title);
  });

  it('is the brand alone for a page with no title of its own', () => {
    expect(buildPageTitle('')).toBe('Founders Coffee');
    expect(buildPageTitle('   ')).toBe('Founders Coffee');
  });

  it('comes out the same when given a title it already built', () => {
    expect(buildPageTitle(buildPageTitle('Algeria'))).toBe(
      'Founders Coffee - Algeria',
    );
  });

  it('stops at seventy characters, brand included', () => {
    const title = buildPageTitle('x'.repeat(100));

    expect(Array.from(title)).toHaveLength(70);
    expect(title).toMatch(/^Founders Coffee - x+…$/u);
  });
});
