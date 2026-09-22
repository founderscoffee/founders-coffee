import { afterEach, describe, expect, it, vi } from 'vitest';

import { localeInPath, storeLocale } from './locale-cookie';

const captureWrites = (): string[] => {
  const writes: string[] = [];
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(
    (value: string) => {
      writes.push(value);
    },
  );
  return writes;
};

afterEach(() => vi.restoreAllMocks());

describe('the cookie this device remembers a language in', () => {
  it('is the one the server render reads, kept for a year across the whole site', () => {
    const writes = captureWrites();

    storeLocale('fr');

    expect(writes).toEqual([
      'PARAGLIDE_LOCALE=fr; path=/; max-age=31536000; samesite=lax',
    ]);
  });

  it('is lax, so it still arrives on a link followed in from somewhere else', () => {
    const writes = captureWrites();

    storeLocale('ar');

    expect(
      writes[0],
      'strict would withhold it on exactly the shared link worth remembering',
    ).toContain('samesite=lax');
  });
});

describe('the language a path names outright', () => {
  it.each([
    ['/fr/algeria', 'fr'],
    ['/ar/algeria/e/some-event', 'ar'],
    ['/en', 'en'],
  ] as const)('reads %s as %s', (pathname, locale) => {
    expect(localeInPath(pathname)).toBe(locale);
  });

  it.each(['/', '/algeria/algiers', '/login', '/profile/activity'])(
    'reads %s as naming none, leaving the stored language alone',
    (pathname) => {
      expect(localeInPath(pathname)).toBeNull();
    },
  );

  it('does not mistake a market whose slug merely starts with a locale', () => {
    expect(localeInPath('/england/london')).toBeNull();
  });
});
