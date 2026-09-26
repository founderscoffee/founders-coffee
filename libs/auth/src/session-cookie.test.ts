import { describe, expect, it } from 'vitest';

import { sessionTokenFromCookie } from './session-cookie.js';

const SESSION = '__Secure-better-auth.session_token';

describe('sessionTokenFromCookie', () => {
  it('reads the token from the session cookie and drops the signature', () => {
    expect(sessionTokenFromCookie(`${SESSION}=abc.c2lnbmF0dXJl%3D`)).toBe(
      'abc',
    );
    expect(sessionTokenFromCookie(`${SESSION}=a.b.sig`)).toBe('a.b');
  });

  it('finds the session cookie among others, wherever it sits', () => {
    expect(sessionTokenFromCookie(`theme=dark; ${SESSION}=abc.sig`)).toBe(
      'abc',
    );
    expect(sessionTokenFromCookie(`${SESSION}=abc.sig; theme=dark`)).toBe(
      'abc',
    );
    expect(sessionTokenFromCookie(`a=1;${SESSION}=abc.sig;b=2`)).toBe('abc');
  });

  it('reads no cookie but the one Better Auth sets', () => {
    for (const name of [
      'better-auth.session_token',
      'other.session_token',
      `x${SESSION}`,
      'theme',
    ])
      expect(sessionTokenFromCookie(`${name}=abc.sig`), name).toBeNull();
  });

  it('reads the first copy of the session cookie alone, as Better Auth does', () => {
    expect(
      sessionTokenFromCookie(`${SESSION}=first.sig; ${SESSION}=second.sig`),
    ).toBe('first');
    expect(
      sessionTokenFromCookie(`${SESSION}=unsigned; ${SESSION}=second.sig`),
    ).toBeNull();
  });

  it('answers nothing without a signed session cookie', () => {
    for (const header of [
      null,
      '',
      'theme=dark',
      `${SESSION}=`,
      `${SESSION}=abc`,
      `${SESSION}=.sig`,
    ])
      expect(sessionTokenFromCookie(header), String(header)).toBeNull();
  });

  it('reads a malformed escape as written instead of throwing', () => {
    expect(sessionTokenFromCookie(`${SESSION}=ab%E0%A4%A.sig`)).toBe(
      'ab%E0%A4%A',
    );
  });
});
