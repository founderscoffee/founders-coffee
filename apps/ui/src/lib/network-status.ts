import { useEffect, useState } from 'react';

const PENDING_GRACE_MS = 8_000;

/**
 * Whether the browser believes it can reach the network.
 *
 * Optimistic on the server and on the first client render — a "you are offline" bar the server
 * never rendered would be a hydration mismatch — and only truthful once mounted. `navigator.onLine`
 * is a floor rather than a promise: a captive portal or a stalled cell connection reports `true`
 * while nothing reaches the origin, which is why {@link useBoundedPending} bounds the wait by time
 * as well as by this flag.
 */
export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return isOnline;
};

/**
 * A pending flag that is guaranteed to settle, so a loading state cannot become permanent.
 *
 * Neither read behind the header carries a deadline. Better Auth passes its own abort signal to
 * every `/api/auth/get-session` call, and the fetch client it uses ignores its `timeout` option
 * whenever a signal is supplied, so a request that stalls stalls forever; a TanStack Query in the
 * default network mode pauses rather than fails while the browser reports itself offline, which
 * leaves its own `isPending` true for as long as the tab is open. Either way the member watches a
 * pulsing circle that never resolves — and the case that produces it is a connection that hangs
 * rather than refuses, which is the ordinary one on Algerian mobile data, not only a clean
 * disconnection.
 *
 * Giving up reports the unauthenticated state, which is the honest answer: we do not know who this
 * is. It is also self-correcting, because a read that lands late still flips the flag back.
 */
export const useBoundedPending = (isPending: boolean): boolean => {
  const isOnline = useOnlineStatus();
  const [hasWaited, setHasWaited] = useState(false);

  useEffect(() => {
    if (!isPending) return undefined;
    setHasWaited(false);
    const timer = setTimeout(() => setHasWaited(true), PENDING_GRACE_MS);
    return () => clearTimeout(timer);
  }, [isPending]);

  return isPending && isOnline && !hasWaited;
};
