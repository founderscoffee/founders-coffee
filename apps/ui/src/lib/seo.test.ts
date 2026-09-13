import { describe, expect, it } from 'vitest';

import { runWithContext } from '@founders-coffee/observability/context';

import { canonicalPath, canonicalUrl } from './seo';

describe('canonical URLs', () => {
  it('builds query-free paths for every public route class', () => {
    expect(canonicalPath({ type: 'root' })).toBe('/');
    expect(canonicalPath({ type: 'market', market: 'algeria' })).toBe(
      '/algeria',
    );
    expect(
      canonicalPath({ type: 'city', market: 'algeria', city: 'algiers' }),
    ).toBe('/algeria/algiers');
    expect(
      canonicalPath({
        type: 'event',
        market: 'algeria',
        slug: 'founders-coffee',
      }),
    ).toBe('/algeria/e/founders-coffee');
    expect(
      canonicalPath({ type: 'company', path: '/about/?utm_source=campaign' }),
    ).toBe('/about');
  });

  it('encodes route segments and uses the request origin', () => {
    expect(
      canonicalPath({ type: 'city', market: 'market name', city: 'city/name' }),
    ).toBe('/market%20name/city%2Fname');
    expect(
      runWithContext({ siteOrigin: 'https://staging.founders.coffee' }, () =>
        canonicalUrl({ type: 'event', market: 'algeria', slug: 'meetup' }),
      ),
    ).toBe('https://staging.founders.coffee/algeria/e/meetup');
  });
});
