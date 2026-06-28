import { describe, expect, it } from 'vitest';

import { resolveLocaleFor } from './locale.js';

describe('resolveLocaleFor', () => {
  it('uses the cookie locale when it is valid', () => {
    expect(resolveLocaleFor('ar', 'fr')).toBe('fr');
    expect(resolveLocaleFor('ar', 'en')).toBe('en');
  });

  it('falls back to the market default when the cookie is absent or invalid', () => {
    expect(resolveLocaleFor('ar')).toBe('ar');
    expect(resolveLocaleFor('ar', 'de')).toBe('ar');
    expect(resolveLocaleFor('ar', '')).toBe('ar');
  });
});
