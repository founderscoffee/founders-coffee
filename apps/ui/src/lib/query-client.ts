import { QueryClient } from '@tanstack/react-query';

/**
 * One cache per browser tab, and one per server render.
 *
 * A module-level client is a single object shared by every request an isolate handles, which on
 * Workers means shared between whoever happens to be served concurrently. Nothing writes to it
 * during SSR today, so this is a trap rather than a leak — but it is the trap the next person to
 * add a loader prefetch would fall into, and the cost of not having it is one object per render.
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
