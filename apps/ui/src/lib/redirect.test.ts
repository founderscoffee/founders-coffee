import { describe, expect, it } from 'vitest';

import {
  onboardingRedirectPath,
  safeRedirectPath,
  sameOriginPathSchema,
} from './redirect';

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
      onboardingRedirectPath('/algeria/host/create?city=556&state=16'),
    ).toBe(
      '/onboarding?redirect=%2Falgeria%2Fhost%2Fcreate%3Fcity%3D556%26state%3D16',
    );
    expect(onboardingRedirectPath('//attacker.example/steal')).toBe(
      '/onboarding?redirect=%2F',
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
