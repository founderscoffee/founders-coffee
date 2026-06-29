import { baseLocale, cookieName, isLocale } from './paraglide/runtime.js';
import type { Locale } from './locale.js';

/**
 * Resolve the active locale from the Paraglide cookie — pure (no `Request` dep), runs in a
 * server-fn, the edge, or a unit test. **Arabic-first:** the base locale `ar` is the default
 * (SRS §8.6 amended — `Accept-Language` is no longer consulted; the locale toggle is the only
 * override). The locale is threaded explicitly to message calls + formatters, avoiding global
 * runtime state — safe on Cloudflare (no `paraglideMiddleware`, sidesteps TanStack #6268).
 */
export const detectLocale = (cookieHeader: string | null): Locale => {
  if (cookieHeader) {
    const entry = cookieHeader
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName}=`));
    const value = entry?.split('=')[1];
    if (value && isLocale(value)) return value;
  }
  return baseLocale;
};
