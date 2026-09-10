import { afterEach, describe, expect, it, vi } from 'vitest';

import { adoptStoredLocale, localeNeedsReconciling } from './stored-locale';

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('localeNeedsReconciling', () => {
  it('is true when the account says one language and the device shows another', () => {
    expect(localeNeedsReconciling('fr', 'ar')).toBe(true);
  });

  it('is false when they already agree', () => {
    expect(localeNeedsReconciling('fr', 'fr')).toBe(false);
  });

  it('leaves the cookie chain alone when the member has chosen nothing', () => {
    expect(localeNeedsReconciling(null, 'ar')).toBe(false);
    expect(localeNeedsReconciling(undefined, 'ar')).toBe(false);
  });

  it('ignores a stored value that is not a locale we ship', () => {
    expect(localeNeedsReconciling('kl', 'ar')).toBe(false);
  });
});

describe('adoptStoredLocale', () => {
  it('writes the cookie the server render reads', () => {
    adoptStoredLocale('fr', vi.fn());

    expect(document.cookie).toContain('fr');
  });

  it('reloads, because the page was rendered in the other language', () => {
    const reload = vi.fn();

    adoptStoredLocale('fr', reload);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('tries once per tab, so a browser refusing the cookie cannot loop', () => {
    const reload = vi.fn();

    expect(adoptStoredLocale('fr', reload)).toBe(true);
    expect(adoptStoredLocale('fr', reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('tries again when the member changes to a different language', () => {
    const reload = vi.fn();

    adoptStoredLocale('fr', reload);
    adoptStoredLocale('en', reload);

    expect(reload).toHaveBeenCalledTimes(2);
  });
});
