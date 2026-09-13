import { describe, expect, it } from 'vitest';

import {
  isCacheSafeEarlyHint,
  isPublicEarlyHintsPath,
  removeEarlyHintsFromResponse,
  shouldEmitEarlyHints,
} from './early-hints';

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
    expect(isPublicEarlyHintsPath('/ar/account')).toBe(false);
    expect(isPublicEarlyHintsPath('/ar/algeria/unknown/path')).toBe(false);
  });

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
