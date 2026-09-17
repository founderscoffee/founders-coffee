import { describe, expect, it } from 'vitest';

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
