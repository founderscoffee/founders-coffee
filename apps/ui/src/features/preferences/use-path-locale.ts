import { useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

import { localeInPath, storeLocale } from './locale-cookie';

/**
 * Remember the language a locale-prefixed page was read in.
 *
 * The prefix already decided what the page rendered in, but it wrote nothing down, so a reader who
 * arrived on a shared `/fr/…` link and never touched the toggle was served Arabic the next time
 * they reached a path carrying no prefix — the logo, a bookmark, the installed app. Shared links
 * are this product's main way in, which makes that the common case and not an edge one.
 *
 * A prefix overwrites a language the reader chose earlier. The page in front of them is the better
 * evidence of what they read in, and the toggle is one click from undoing it.
 *
 * It runs in the browser rather than as a `Set-Cookie` on the render, because public documents are
 * shared-cached for a minute (`s-maxage=60`) and a response that carries a cookie is one a CDN will
 * not hold. The cookie is only ever read on a later request, so writing it a tick after paint costs
 * nothing that matters.
 *
 * Ordering with `useStoredLocale` is deliberate: that one adopts a signed-in member's saved
 * language and reloads, and this runs after it, so on a prefixed path the prefix is what ends up
 * stored. Its own sentinel stops the reload repeating, so the two do not trade writes.
 */
export const usePathLocale = (): void => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    const locale = localeInPath(pathname);
    if (locale) storeLocale(locale);
  }, [pathname]);
};
