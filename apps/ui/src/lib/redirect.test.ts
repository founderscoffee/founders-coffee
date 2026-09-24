import { describe, expect, it } from 'vitest';

import {
  onboardingRedirectPath,
  pathDestination,
  safeRedirectPath,
  sameOriginPathSchema,
} from './redirect';
import { stringifySearch } from './search-params';

describe('sameOriginPathSchema', () => {
  it.each(['/algeria/host/create?city=160#confirmation', '/onboarding', '/'])(
    'accepts the same-origin path %s',
    (path) => {
      expect(sameOriginPathSchema.parse(path)).toBe(path);
    },
  );

  it.each([
    'https://attacker.example/steal',
    '//attacker.example/steal',
    '\\attacker.example/steal',
    'javascript:alert(1)',
    '',
  ])('rejects the unsafe redirect %s', (path) => {
    expect(sameOriginPathSchema.safeParse(path).success).toBe(false);
  });

  it('falls back to the site root', () => {
    expect(safeRedirectPath('https://attacker.example')).toBe('/');
  });

  it('builds a safe onboarding path for a new authenticated user', () => {
    expect(
      onboardingRedirectPath('ar', '/algeria/host/create?city=556&state=16'),
    ).toBe(
      '/ar/onboarding?redirect=%2Falgeria%2Fhost%2Fcreate%3Fcity%3D556%26state%3D16',
    );
    expect(onboardingRedirectPath('ar', '//attacker.example/steal')).toBe(
      '/ar/onboarding?redirect=%2F',
    );
  });
});

describe('AR: the produced path, not just the accepted one', () => {
  const NORMALISING = [
    '/..//attacker.example',
    '/.//attacker.example',
    '/foo/../..//attacker.example',
    '/../..//attacker.example',
    '/..//attacker.example/steal?a=1',
  ];

  it.each(NORMALISING)(
    'rejects %s, which resolves to our origin but yields a protocol-relative path',
    (path) => {
      expect(sameOriginPathSchema.safeParse(path).success).toBe(false);
      expect(safeRedirectPath(path)).toBe('/');
    },
  );

  it('never returns a value a browser would read as another site', () => {
    const candidates = [
      '/algeria/host/create?city=1',
      '/..//attacker.example',
      '//attacker.example',
      '/' + String.fromCharCode(92, 92) + 'attacker.example',
      '/onboarding#x',
      'https://attacker.example',
    ];
    for (const candidate of candidates) {
      const result = safeRedirectPath(candidate);
      expect(result.startsWith('/')).toBe(true);
      expect(result.startsWith('//')).toBe(false);
      expect(new URL(result, 'https://founders.coffee').origin).toBe(
        'https://founders.coffee',
      );
    }
  });

  it('keeps a legitimate deep path intact', () => {
    expect(safeRedirectPath('/algeria/host/create?city=160#confirmation')).toBe(
      '/algeria/host/create?city=160#confirmation',
    );
  });
});

describe('pathDestination', () => {
  it('splits a path the way a navigation splits an href', () => {
    expect(
      pathDestination('/fr/algeria/algiers?page=2&tab=past#events'),
    ).toEqual({
      to: '/fr/algeria/algiers',
      search: { page: 2, tab: 'past' },
      hash: 'events',
    });
  });

  it('carries no query and no fragment for a path that has neither', () => {
    expect(pathDestination('/')).toEqual({ to: '/', search: {}, hash: '' });
  });

  it.each([
    '?page=2',
    '?redirect=%2Ffr%2Falgeria',
    '?q=caf%C3%A9&page=2',
    '?q=%22x%22',
  ])('reads %s so that the router writes it back out as it was', (query) => {
    expect(
      stringifySearch(pathDestination(`/fr/algeria${query}`).search),
      'a query read any other way than the router reads it is sent on as a different address',
    ).toBe(query);
  });
});
