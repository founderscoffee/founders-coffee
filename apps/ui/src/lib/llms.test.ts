import { describe, expect, it } from 'vitest';

import { LOCALES } from '@founders-coffee/i18n';
import type { SitemapData } from '@founders-coffee/server-fns';

import { llmsText, stagingLlmsText } from './llms';

const data: SitemapData = {
  markets: [{ slug: 'algeria' }],
  cities: [{ market: 'algeria', city: 'algiers' }],
  events: [
    {
      market: 'algeria',
      slug: 'coffee-and-code',
      updatedAt: new Date('2026-09-13T08:00:00.000Z'),
    },
  ],
};

describe('llms discovery guide', () => {
  it('contains only canonical public discovery surfaces', () => {
    const text = llmsText('https://founders.coffee', data, 'en');

    expect(text).toContain('# Founders Coffee');
    expect(text).toContain('The current release focuses on free local events');
    expect(text).toContain('https://founders.coffee/en');
    expect(text).toContain('https://founders.coffee/en/algeria');
    expect(text).toContain('https://founders.coffee/en/algeria/algiers');
    expect(text).toContain(
      'https://founders.coffee/en/algeria/e/coffee-and-code',
    );
    expect(text).toContain('https://founders.coffee/en/about');
    expect(text).toContain('https://founders.coffee/sitemap.xml');
    expect(text).toContain('https://founders.coffee/robots.txt');
    expect(text).toContain('https://founders.coffee/events.json');
    expect(text).not.toContain('/u/');
    expect(text).not.toContain('staging.founders.coffee');
  });

  it('satisfies the three checks the llms.txt audit runs', () => {
    const text = llmsText('https://founders.coffee', data, 'en');

    expect(text, 'needs an H1').toMatch(/^\s*#\s+.+/mu);
    expect(text, 'needs a markdown hyperlink').toMatch(/\[.+\]\(.+\)/u);
    expect(text.length, 'must not be suspiciously short').toBeGreaterThan(49);
  });

  it('writes every list entry as a markdown hyperlink', () => {
    const text = llmsText('https://founders.coffee', data, 'en');
    const bullets = text.split('\n').filter((line) => line.startsWith('- '));

    expect(bullets.length).toBeGreaterThan(5);
    for (const bullet of bullets) {
      expect(bullet, `${bullet} is not a markdown link`).toMatch(
        /^- \[[^\]]+\]\(https:\/\/[^)]+\)$/u,
      );
    }
  });

  it('titles every section with a label rather than a sentence', () => {
    for (const locale of LOCALES) {
      const headings = llmsText('https://founders.coffee', data, locale)
        .split('\n')
        .filter((line) => line.startsWith('## '));

      expect(headings.length).toBeGreaterThan(2);
      for (const heading of headings) {
        expect(
          heading,
          `${locale}: "${heading}" reads as a sentence, not a heading`,
        ).not.toMatch(/[.!?\u061F]\s*$/u);
      }
    }
  });

  it('keeps staging output free of production inventory', () => {
    const text = stagingLlmsText('en');

    expect(text).toContain(
      'This staging environment is not for public discovery.',
    );
    expect(text).not.toContain('https://');
    expect(text).not.toContain('/sitemap.xml');
  });

  it('localizes guide copy without changing canonical locale entry points', () => {
    const text = llmsText('https://founders.coffee', data, 'ar');

    expect(text).toContain(
      'Founders Coffee مجتمع للقاءات المؤسسين المحلية حول القهوة.',
    );
    expect(text).toContain('https://founders.coffee/ar');
    expect(text).toContain('https://founders.coffee/fr');
    expect(text).toContain('https://founders.coffee/en');
  });
});
