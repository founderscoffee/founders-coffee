import { redirect } from '@tanstack/react-router';

import { safeAuthReturnPath } from '../../lib/redirect';
import { authApi } from './api';

/**
 * Send a signed-out visitor to sign in, before a private page renders anything.
 *
 * Without this the five private routes answered an anonymous request with `200` and the whole
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
export const requireSession = async (returnPath: string): Promise<void> => {
  if (await authApi.hasAuthSession()) return;
  throw redirect({
    to: '/login',
    search: { redirect: safeAuthReturnPath(returnPath) },
  });
};
