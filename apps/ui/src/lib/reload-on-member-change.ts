import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { useHydrationSafeSession } from './hydration-safe-session';
import { memberChanged } from './session-cache';

/**
 * Load the route's data again when the member reading it changes while the page stays loaded.
 *
 * A route whose loader answers for its reader renders for the member who asked: the meetup page
 * takes from its loader whether they host it and whether they are going. Signing out from the
 * header, a session found expired on a refetch, or another tab signing in as someone else changes
 * the member under a page that loads no new document, and it would go on showing the previous
 * member's panel. The first settled session is not a change, because the page was just loaded for
 * it. This is for the page on screen; the pages the router keeps for Back are dropped with the
 * member's other caches (`withdrawMemberCaches`).
 */
export const useReloadOnMemberChange = (): void => {
  const { data, isPending } = useHydrationSafeSession();
  const router = useRouter();
  const memberId = data?.user?.id ?? null;
  const seen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) return;
    const previous = seen.current;
    seen.current = memberId;
    if (memberChanged(previous, memberId)) void router.invalidate();
  }, [memberId, isPending, router]);
};
