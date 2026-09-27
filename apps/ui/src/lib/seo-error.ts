import {
  error_body,
  error_title,
  not_found_body,
  not_found_title,
  type Locale,
} from '@founders-coffee/i18n';

import { NO_INDEX_VALUE } from './indexation';
import { buildPageTitle } from './seo';

export type ErrorPageKind = 'error' | 'notFound';

type MatchState = {
  readonly status: string;
  readonly globalNotFound?: boolean;
};

/**
 * Which error page this render is, if it is one, read from the root match as well as the list.
 *
 * The root route's `head` and `headers` are handed the matches as they stood when loading began,
 * and router-core records a `notFound()` on its boundary match only after that, so the list never
 * shows one: every 404 went out with no `<title>` and no robots tag (#117). The root match they are
 * handed alongside the list is read fresh, which is why the root declares the `notFoundComponent`
 * and is the boundary for every route. Left to the router's default, the route that threw became
 * its own boundary, where no root head could see it.
 */
export const errorPageKind = (
  root: MatchState,
  matches: readonly MatchState[],
): ErrorPageKind | null => {
  const states = [root, ...matches];
  if (
    states.some(
      (match) => match.status === 'notFound' || match.globalNotFound === true,
    )
  )
    return 'notFound';
  return states.some((match) => match.status === 'error') ? 'error' : null;
};

export const errorPageHead = (locale: Locale, kind: ErrorPageKind) => {
  const copy =
    kind === 'notFound'
      ? {
          title: not_found_title({}, { locale }),
          description: not_found_body({}, { locale }),
        }
      : {
          title: error_title({}, { locale }),
          description: error_body({}, { locale }),
        };
  return {
    meta: [
      { title: buildPageTitle(copy.title) },
      { name: 'description', content: copy.description },
      { name: 'robots', content: NO_INDEX_VALUE },
    ],
    links: [],
    scripts: [],
  };
};
