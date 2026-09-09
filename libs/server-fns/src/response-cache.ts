import { setResponseHeader } from '@tanstack/react-start/server';

/**
 * Mark a response whose body depends on who asked for it.
 *
 * The event feed, the event page and every profile read carry something that is true of the caller
 * and no one else — `viewerRsvp`, an owner's unpublished fields. Without a directive, a shared
 * cache anywhere on the path is entitled to treat one visitor's answer as everyone's, and the
 * response looks like a public listing. `private` refuses the shared copy, `no-store` refuses the
 * local one, and the pair is what makes signing out on a shared machine withdraw what was on
 * screen rather than leave it one Back press away.
 *
 * Indexing directives deliberately do not belong here. A server function called from a route
 * loader runs inside the document request, so anything it sets lands on the *page*, not on its own
 * payload — an `X-Robots-Tag` added for the profile endpoint travelled down the host lookup and
 * took every event page out of the index with it. Whether a page may be indexed is a fact about
 * the route, and it is declared there.
 */
export const privateNoStore = (): void => {
  setResponseHeader('Cache-Control', 'private, no-store');
};
