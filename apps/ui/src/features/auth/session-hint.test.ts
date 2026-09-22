import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_SLOT_KEY,
  AUTH_SLOT_SCRIPT,
  readAuthSlot,
  writeAuthSlot,
} from './session-hint';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('what the header remembers about its own width', () => {
  it('treats a browser that has never been here as signed out', () => {
    expect(
      readAuthSlot(),
      'a first visit is anonymous far more often than not, and reserving the sign-in width is the state that guess is right about',
    ).toBe('out');
  });

  it('remembers across a visit', () => {
    writeAuthSlot('in');
    expect(readAuthSlot()).toBe('in');
    writeAuthSlot('out');
    expect(readAuthSlot()).toBe('out');
  });

  it('survives a browser that refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(
      () => writeAuthSlot('in'),
      'private modes throw on access rather than returning null, and a header that cannot size itself is not a reason to fail a page',
    ).not.toThrow();
    expect(readAuthSlot()).toBe('out');
  });

  it('reads nothing but its own key', () => {
    expect(AUTH_SLOT_SCRIPT).toContain(AUTH_SLOT_KEY);
    expect(
      AUTH_SLOT_SCRIPT.match(/localStorage/g)?.length,
      'this runs before anything else on every page load, so it touches one key and does nothing else',
    ).toBe(1);
  });

  it('cannot break the document if storage throws inside it', () => {
    expect(
      AUTH_SLOT_SCRIPT.startsWith('try{'),
      'an uncaught throw in a synchronous head script stops the parser, so this one is wrapped',
    ).toBe(true);
    expect(AUTH_SLOT_SCRIPT).toContain('catch');
  });

  it('writes a value the stylesheet can act on, and only that', () => {
    const html = { dataset: {} as Record<string, string> };
    new Function('document', AUTH_SLOT_SCRIPT)({ documentElement: html });

    expect(html.dataset.authSlot).toBe('out');
  });
});
