import { isLocale, type Locale } from '@founders-coffee/i18n';

import { storeLocale } from './locale-cookie';

const SENTINEL = 'fc_locale_reconciled';

/**
 * Whether this render is showing the wrong language for the signed-in member.
 *
 * `user.locale_pref` is the account's language and the paraglide cookie is the device's, and the
 * server render only ever consults the cookie. On the member's own browser the two agree, because
 * saving the preference writes both. On a browser they have just signed into for the first time
 * they do not: the account says French and the cookie, set by nothing, resolves to the Arabic
 * default. Without reconciliation the preference would be a value the product stores and never
 * honours anywhere except the screen that sets it.
 *
 * `null` means the member has not chosen — the cookie, then the market, then `ar` still decide, and
 * that chain is deliberately not overridden here.
 */
export const localeNeedsReconciling = (
  stored: string | null | undefined,
  active: Locale,
): stored is Locale => !!stored && isLocale(stored) && stored !== active;

/**
 * Adopt the account's language on this device, once.
 *
 * Paraglide picks the locale during the server render, so the strings already on the page were
 * chosen before the session was known; only a reload can re-render them all, and re-rendering half
 * of them in React would be worse than either language. The sentinel is what stops that reload
 * becoming a loop: a browser that refuses the cookie would otherwise arrive back in the same state
 * and reload again forever. One attempt per tab, then the page is left alone in whatever language
 * it is in.
 *
 * `reload` is passed in rather than reached for, so the one irreversible thing this function does
 * is visible at the call site and can be observed in a test instead of navigating one.
 */
export const adoptStoredLocale = (
  stored: Locale,
  reload: () => void,
): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(SENTINEL) === stored) return false;
    window.sessionStorage.setItem(SENTINEL, stored);
  } catch {
    return false;
  }
  storeLocale(stored);
  reload();
  return true;
};
