import { baseLocale, cookieName, isLocale } from './paraglide/runtime.js';
import type { Locale } from './locale.js';

/**
 * Resolve the active locale from raw request headers — pure (no `Request` dep),
 * so it runs in a server-fn, the edge, or a unit test. Order: the Paraglide
 * cookie → `Accept-Language` (q-value ranked, language-tag only) → baseLocale.
 *
 * The locale is then threaded explicitly to message calls (m.x({}, { locale }))
 * and formatters, avoiding global runtime state — which is what makes this safe
 * on Cloudflare (no paraglideMiddleware, sidestepping TanStack #6268).
 */
export const detectLocale = (
  cookieHeader: string | null,
  acceptLanguage: string | null,
): Locale => {
  if (cookieHeader) {
    const entry = cookieHeader
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName}=`));
    const value = entry?.split('=')[1];
    if (value && isLocale(value)) return value;
  }

  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(',')
      .map((part) => {
        const [tagRaw, qualifier] = part.trim().split(';');
        const tag = (tagRaw ?? '').trim().split('-')[0];
        const qPart = qualifier ?? 'q=1';
        const qVal = qPart.split('=')[1];
        return { tag, q: qVal ? Number.parseFloat(qVal) : 1 };
      })
      .sort((a, b) => b.q - a.q);
    for (const { tag } of ranked) {
      if (tag && isLocale(tag)) return tag;
    }
  }

  return baseLocale;
};
