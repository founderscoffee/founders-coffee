import type { QueryClient } from '@tanstack/react-query';

import { purgeMemberCacheEntries } from './profile-cache';

/**
 * Whether the member behind this tab has changed since the last settled session.
 *
 * `null` means signed out. The first settled session is never a change — arriving at the site
 * already signed in has nothing to withdraw — but every transition after it is, in both directions.
 * Signing out is the obvious one; signing straight in as someone else on a shared laptop is the one
 * that actually matters, because nothing about that navigation reloads the tab.
 */
export const memberChanged = (
  previous: string | null | undefined,
  next: string | null,
): boolean => previous !== undefined && previous !== next;

/**
 * Withdraw everything the previous member left behind in this tab.
 *
 * Owner profile responses are keyed by user id and held with `gcTime: 0`, so they were never the
 * exposure. The event feed is: `viewerRsvp` says whether *you* are going, and it is cached under
 * `['events', 'upcoming', params]` with no identity in the key at all. Without this, signing out
 * and signing in as someone else leaves the previous member's attendance rendered as the new one's
 * until each query happens to refetch.
 *
 * What no screen is reading is removed, and what a screen is reading is reset and asked for again.
 * Removing a query that a screen is reading cancels its request without telling the screen, so one
 * that asked in the same render the session changed waits indefinitely: the host wizard's sign-in
 * gate, asking for the new member's profile, did exactly that. A reset is not enough for the rest,
 * because it returns a query to the data it started with, and a feed's first page was rendered for
 * the member who has just left. What the previous member sent is forgotten with it.
 *
 * The service-worker caches are swept alongside it. `activate` already does a narrower sweep, but a
 * service worker only activates when a new one is installed, which is not something a sign-out
 * causes.
 */
export const withdrawMemberCaches = async (
  client: QueryClient,
  storage?: CacheStorage,
): Promise<void> => {
  client.getMutationCache().clear();
  client.removeQueries({ type: 'inactive' });
  void client.resetQueries({ type: 'active' });
  if (storage) await purgeMemberCacheEntries(storage);
};
