import { isLocale, type Locale } from '@founders-coffee/i18n';

const LOCALE_DIRECT = new Set([
  'closeout',
  'edit',
  'feedback',
  'login',
  'onboarding',
  'profile',
  'u',
]);

/**
 * Whether this segment follows a language directly, with no market between them.
 *
 * These are the static children of `$locale` that are not also static children of
 * `$locale/$market`. `e` is in both, because `/algeria/e/{slug}` was the canonical address of a
 * meetup before the prefix existed and is still indexed under it, so a market in front of `e` is a
 * market and not noise. A contract test derives this set from the route tree so it cannot drift.
 */
export const isLocaleDirect = (segment: string): boolean =>
  LOCALE_DIRECT.has(segment);

export type PrefixDecision =
  | { readonly kind: 'prefixed' }
  | { readonly kind: 'elsewhere'; readonly href: string }
  | { readonly kind: 'nowhere' };

type KnownMarket = { readonly code: string; readonly slug: string };

/**
 * Where an address that does not open on a language should be answered, if anywhere.
 *
 * One layout sees every address shaped `/{first}/…`, which makes it the only place that has to ask
 * what `first` holds. Sixteen routes used to ask for themselves, and a route added without asking
 * rendered in the reader's cookie language rather than the URL's: it resolves, renders and answers
 * 200, so nothing catches it.
 *
 * Three answers, because a first segment that is not a language is not one kind of thing:
 *
 * - A market — `/algeria`, `/dz/e/{slug}` — belongs to the address, so the language goes in front
 *   of it and the market is written as its slug, which saves the hop the market routes would spend
 *   normalising a code. A code is matched the way `resolveMarket` matches it, without regard to
 *   case, so `/dz` and `/DZ` answer as `/{locale}/algeria` rather than one of them falling through.
 * - Noise in front of a private screen — `/algeria/profile` — belongs to nobody, because those
 *   screens take no market. It is dropped rather than prefixed, which is what `c420e92` settled.
 * - Anything else is not an address here, and says so directly. Sending it to a prefixed form first
 *   would answer a crawler's mistake with a redirect the shared cache is allowed to keep.
 */
export const decidePrefix = (
  href: string,
  fallback: Locale,
  markets: readonly KnownMarket[],
): PrefixDecision => {
  const [, path = '', tail = ''] = /^([^?#]*)(.*)$/u.exec(href) ?? [];
  const segments = path.split('/').filter(Boolean);
  const [first, ...rest] = segments;
  if (first === undefined || isLocale(first)) return { kind: 'prefixed' };

  const at = (parts: readonly string[]) => `/${parts.join('/')}${tail}`;
  if (rest[0] !== undefined && isLocaleDirect(rest[0]))
    return { kind: 'elsewhere', href: at([fallback, ...rest]) };

  const code = first.toUpperCase();
  const market = markets.find(
    (candidate) => candidate.slug === first || candidate.code === code,
  );
  return market
    ? { kind: 'elsewhere', href: at([fallback, market.slug, ...rest]) }
    : { kind: 'nowhere' };
};
