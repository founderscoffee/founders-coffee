import { useHydrated } from '@tanstack/react-router';

import { authClient } from './auth';

const UNRESOLVED = { data: null, isPending: true } as const;

/**
 * The session as a render may show it: still resolving until hydration has committed, then the
 * browser's own answer.
 *
 * The server always renders the session as resolving, because the document is shared-cached and
 * must carry nobody's identity. The browser does not wait for hydration to ask: Better Auth's store
 * starts `/api/auth/get-session` the first time any render reads it (the root layout does, above
 * the providers), and Start hydrates in a transition, which yields to the network between
 * components. The answer could land before React reached the provider, which then hydrated with a
 * session the server never rendered. React 19 throws away a tree whose text differs and renders it
 * again, which a host's own meetup page went through, but an attribute it leaves as the server sent
 * it: the host wizard's action button kept the server's `disabled` while React believed it enabled,
 * until something changed the prop again.
 *
 * Answering what the server rendered for as long as React is hydrating keeps the first client
 * render identical to the HTML. The real session then arrives as an ordinary update, which React
 * writes to the DOM like any other.
 */
export const useHydrationSafeSession = () => {
  const session = authClient.useSession();
  return useHydrated() ? session : UNRESOLVED;
};
