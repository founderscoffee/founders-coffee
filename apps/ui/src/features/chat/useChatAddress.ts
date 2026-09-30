import {
  useLocation,
  useNavigate,
  useRouter,
  useSearch,
} from '@tanstack/react-router';
import { useCallback } from 'react';

const MEETUP_ROUTE = '/$locale/$market/e/$slug';

/**
 * Whether a meetup's chat panel is open, as its address says, and the ways to open and close it.
 *
 * The open panel is `?chat=true` on the meetup's own address, so a link, a push or a reload opens
 * the page with the panel open, and the page keeps its canonical address and its one loader call.
 *
 * Opening adds a history entry, marked as opened here, so Back closes the panel. Closing a panel
 * this page opened goes back to that entry rather than adding another, which would leave Back
 * reopening it; closing one the page was opened with replaces the address instead, since going
 * back from there would leave the page. Neither moves the page's scroll.
 */
export const useChatAddress = () => {
  const isOpen = useSearch({
    from: MEETUP_ROUTE,
    select: (search) => search.chat === true,
  });
  const wasOpenedHere = useLocation({
    select: (location) => location.state.chatOpenedHere === true,
  });
  const navigate = useNavigate({ from: MEETUP_ROUTE });
  const router = useRouter();

  const open = useCallback(() => {
    void navigate({
      search: (previous) => ({ ...previous, chat: true }),
      state: { chatOpenedHere: true },
      resetScroll: false,
    });
  }, [navigate]);

  const close = useCallback(() => {
    if (wasOpenedHere) {
      router.history.back();
      return;
    }
    void navigate({
      search: (previous) => ({ ...previous, chat: undefined }),
      replace: true,
      resetScroll: false,
    });
  }, [navigate, router, wasOpenedHere]);

  return { isOpen, open, close };
};
