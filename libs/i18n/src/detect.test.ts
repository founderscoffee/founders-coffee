import { describe, expect, it } from 'vitest';

import { cookieName } from './paraglide/runtime.js';
import { detectLocale } from './detect.js';

const cookie = (locale: string) => `${cookieName}=${locale}`;

describe('libs/i18n detectLocale (Arabic-first, cookie-only)', () => {
  it('uses the cookie locale when present', () => {
    expect(detectLocale(cookie('fr'))).toBe('fr');
    expect(detectLocale(cookie('en'))).toBe('en');
  });

  it('ignores an invalid cookie value', () => {
    expect(detectLocale(`${cookieName}=de`)).toBe('ar');
  });

  it('defaults to the base locale ar — Accept-Language is no longer consulted', () => {
    expect(detectLocale(null)).toBe('ar');
  });
});
