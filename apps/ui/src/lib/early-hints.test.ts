import { describe, expect, it } from 'vitest';

import {
  isCacheSafeEarlyHint,
  isPublicEarlyHintsPath,
  removeEarlyHintsFromResponse,
  shouldEmitEarlyHints,
} from './early-hints';
import {
  PRIVATE_SCREENS_IN_EVERY_LANGUAGE,
  PRIVATE_SCREEN_STUBS,
  PRIVATE_SCREEN_VARIANTS,
  PUBLIC_PAGES_NAMING_A_SCREEN,
} from './private-screens.fixtures';

describe('Early Hints policy', () => {
  it('allows only locale-prefixed public page shapes', () => {
    expect(isPublicEarlyHintsPath('/ar/algeria')).toBe(true);
    expect(isPublicEarlyHintsPath('/fr/algeria/algiers')).toBe(true);
    expect(isPublicEarlyHintsPath('/en/algeria/e/coffee-chat')).toBe(true);
    expect(isPublicEarlyHintsPath('/ar/about')).toBe(true);
    expect(isPublicEarlyHintsPath('/')).toBe(false);
    expect(isPublicEarlyHintsPath('/ar')).toBe(false);
    expect(isPublicEarlyHintsPath('/about')).toBe(false);
    expect(isPublicEarlyHintsPath('/login')).toBe(false);
    expect(isPublicEarlyHintsPath('/ar/profile/notifications')).toBe(false);
    expect(isPublicEarlyHintsPath('/ar/algeria/unknown/path')).toBe(false);
  });

  it.each([
    ...PRIVATE_SCREENS_IN_EVERY_LANGUAGE,
    ...PRIVATE_SCREEN_STUBS,
    ...PRIVATE_SCREEN_VARIANTS,
  ])('emits no hints for %s, which answers with a private screen', (path) => {
    expect(isPublicEarlyHintsPath(path)).toBe(false);
  });

  it.each(PUBLIC_PAGES_NAMING_A_SCREEN)(
    'keeps the hints of %s, a public page that names a screen only further in',
    (path) => {
      expect(isPublicEarlyHintsPath(path)).toBe(true);
    },
  );

  it('requires an HTML navigation request', () => {
    const request = new Request('https://founders.coffee/ar/algeria', {
      headers: { accept: 'text/html' },
    });
    expect(shouldEmitEarlyHints(request, '/ar/algeria')).toBe(true);
    expect(
      shouldEmitEarlyHints(
        new Request('https://founders.coffee/ar/algeria', {
          method: 'POST',
          headers: { accept: 'text/html' },
        }),
        '/ar/algeria',
      ),
    ).toBe(false);
    expect(
      shouldEmitEarlyHints(
        new Request('https://founders.coffee/ar/algeria', {
          headers: { accept: 'application/json' },
        }),
        '/ar/algeria',
      ),
    ).toBe(false);
  });

  it('keeps only same-origin immutable build assets', () => {
    const entry = {
      phase: 'static' as const,
      hint: {
        href: '/assets/route.js',
        rel: 'modulepreload' as const,
      },
      link: '<https://founders.coffee/assets/route.js>; rel=modulepreload; as=script',
    };
    expect(isCacheSafeEarlyHint(entry, 'https://founders.coffee')).toBe(true);
    expect(
      isCacheSafeEarlyHint(
        {
          ...entry,
          hint: { href: 'https://cdn.example/route.js', rel: 'preload' },
        },
        'https://founders.coffee',
      ),
    ).toBe(false);
    expect(
      isCacheSafeEarlyHint(
        {
          ...entry,
          hint: { href: '/assets/route.js?token=1', rel: 'preload' },
        },
        'https://founders.coffee',
      ),
    ).toBe(false);
    expect(
      isCacheSafeEarlyHint(
        { ...entry, hint: { href: '/images/hero.webp', rel: 'preload' } },
        'https://founders.coffee',
      ),
    ).toBe(false);
  });

  it("lets through the connection a meetup page opens to Mapbox for its map's picture, and no other", () => {
    const preconnect = (href: string) => ({
      phase: 'dynamic' as const,
      hint: { href, rel: 'preconnect' as const },
      link: `<${href}>; rel=preconnect`,
    });

    expect(
      isCacheSafeEarlyHint(
        preconnect('https://api.mapbox.com'),
        'https://founders.coffee',
      ),
    ).toBe(true);
    expect(
      isCacheSafeEarlyHint(
        preconnect('https://cdn.example'),
        'https://founders.coffee',
      ),
    ).toBe(false);
    expect(
      isCacheSafeEarlyHint(
        preconnect('https://api.mapbox.com/styles/v1'),
        'https://founders.coffee',
      ),
      'a path would be more than the origin a connection needs',
    ).toBe(false);
    expect(
      isCacheSafeEarlyHint(
        {
          phase: 'dynamic',
          hint: { href: 'https://api.mapbox.com', rel: 'dns-prefetch' },
          link: '<https://api.mapbox.com>; rel=dns-prefetch',
        },
        'https://founders.coffee',
      ),
    ).toBe(false);
  });

  it('removes Link hints from redirects, errors, and non-HTML responses', () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { Link: '</assets/route.js>; rel=modulepreload' },
    });
    expect(removeEarlyHintsFromResponse(redirect).headers.has('Link')).toBe(
      false,
    );

    const html = new Response('<html></html>', {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        Link: '</assets/route.js>; rel=modulepreload',
      },
    });
    expect(removeEarlyHintsFromResponse(html).headers.has('Link')).toBe(true);
  });
});
