import { describe, expect, it } from 'vitest';

import { withoutRedirectCaching } from './redirect-caching';

const redirect = (
  status: number,
  headers: Record<string, string> = {},
): Response =>
  new Response(null, {
    status,
    headers: { Location: '/ar/about', ...headers },
  });

describe('the redirect cache floor', () => {
  it.each([301, 302, 303, 307, 308])(
    'keeps a %i that names no policy out of shared caches',
    (status) => {
      const response = withoutRedirectCaching(redirect(status));

      expect(response.status).toBe(status);
      expect(response.headers.get('Location')).toBe('/ar/about');
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    },
  );

  it('keeps every cookie the redirect sets', () => {
    const headers = new Headers({ Location: '/ar/algeria' });
    headers.append('Set-Cookie', 'fc_geo=algeria; Path=/');
    headers.append('Set-Cookie', 'PARAGLIDE_LOCALE=ar; Path=/');

    const response = withoutRedirectCaching(
      new Response(null, { status: 307, headers }),
    );

    expect(response.headers.getSetCookie()).toEqual([
      'fc_geo=algeria; Path=/',
      'PARAGLIDE_LOCALE=ar; Path=/',
    ]);
  });

  it('leaves a redirect that names its own policy exactly as it chose', () => {
    for (const policy of ['public, max-age=3600', 'no-cache', 'no-store']) {
      const response = redirect(301, { 'Cache-Control': policy });

      expect(withoutRedirectCaching(response), policy).toBe(response);
    }
  });

  it('copes with the locked headers of Response.redirect', () => {
    const response = withoutRedirectCaching(
      Response.redirect('https://founders.coffee/og-default.png', 302),
    );

    expect(response.headers.get('Location')).toBe(
      'https://founders.coffee/og-default.png',
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each([200, 204, 300, 304, 404, 500])(
    'leaves a %i alone, which is not a redirect',
    (status) => {
      const response = new Response(null, { status });

      expect(withoutRedirectCaching(response)).toBe(response);
    },
  );
});
