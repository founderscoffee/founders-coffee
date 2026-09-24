import { redirect } from '@tanstack/react-router';

import type { Locale } from '@founders-coffee/i18n';

import { localizedLogin } from '../../lib/locale-routing';
import { safeAuthReturnPath } from '../../lib/redirect';
import { authApi } from './api';

/**
 * Send a signed-out visitor to sign in, before a private page renders anything.
 *
 * Without this the private routes answered an anonymous request with `200` and the whole
 * private shell — the account tabs, the page heading, copy promising that only you can see this —
 * wrapped around a sign-in button. Nothing private was in it, because every one of those pages
 * fetches its own data behind a permission check, but it read as a page belonging to someone who
 * was not there. It also hydrated badly: the server rendered the loading branch and the client
 * rendered the sign-in branch, so React threw the tree away and built it again.
 *
 * `beforeLoad` runs on the server for the first request and on the client for navigations after
 * it, and the check is deliberately made in both — an expired session should reach sign-in the
 * same way, rather than a shell with a button in it.
 *
 * The path is normalised on the way in rather than trusted to the login route's own parser, so a
 * caller cannot hand a visitor a redirect off this origin.
 */
export const requireSession = async (
  locale: Locale,
  returnPath: string,
): Promise<void> => {
  if (await authApi.hasAuthSession()) return;
  throw redirect({
    ...localizedLogin(locale),
    search: { redirect: safeAuthReturnPath(returnPath) },
  });
};

/**
 * Send a signed-in visitor away from the sign-in page, before it renders.
 *
 * Signing in is not something a signed-in reader can do, so the page has nothing to offer them: it
 * asks for an address they have already proved and offers a button that starts a flow ending where
 * they already are. Reaching it is an accident — a bookmark, browser back after signing in, a tab
 * left open in another window — and the useful answer to an accident is the page they meant.
 *
 * They go to the return path directly rather than through `/onboarding`, which is where a fresh
 * sign-in goes. That route renders the profile-completion form unconditionally, so handing an
 * already-onboarded reader to it would ask them to finish something they finished.
 *
 * The path is normalised here rather than trusted to the route's own parser, for the reason
 * `requireSession` normalises: `authReturnPathSchema` rejects `/login`, so a crafted
 * `?redirect=/login` cannot bounce a reader between this guard and the page it guards.
 */
export const redirectWhenSignedIn = async (
  returnPath: string,
): Promise<void> => {
  if (!(await authApi.hasAuthSession())) return;
  throw redirect({ href: safeAuthReturnPath(returnPath) });
};
