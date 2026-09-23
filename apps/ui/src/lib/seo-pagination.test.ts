import { describe, expect, it } from 'vitest';

import { runWithContext } from '@founders-coffee/observability/context';

import { canonicalUrl, localeAlternates } from './seo';

describe('pagination SEO URLs', () => {
  it('keeps a cursor query on the canonical URL', () => {
    expect(
      runWithContext({ siteOrigin: 'https://staging.founders.coffee' }, () =>
        canonicalUrl({
          type: 'market',
          market: 'algeria',
          locale: 'en',
          query: 'afterStartsAt=1725000000000&afterId=evt_123',
        }),
      ),
    ).toBe(
      'https://staging.founders.coffee/en/algeria?afterStartsAt=1725000000000&afterId=evt_123',
    );
  });

  it('keeps the pagination query on localized alternates', () => {
    const alternates = runWithContext(
      { siteOrigin: 'https://founders.coffee' },
      () =>
        localeAlternates({
          type: 'market',
          market: 'algeria',
          locale: 'ar',
          query: 'afterStartsAt=42&afterId=evt_1',
        }),
    );

    expect(alternates[0]?.href).toBe(
      'https://founders.coffee/ar/algeria?afterStartsAt=42&afterId=evt_1',
    );
    expect(
      alternates.at(-1)?.href,
      'x-default names a language now, so it carries the cursor like the rest of them',
    ).toBe('https://founders.coffee/ar/algeria?afterStartsAt=42&afterId=evt_1');
  });
});
