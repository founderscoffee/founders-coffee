import { createServerFn } from '@tanstack/react-start';

import { authMiddleware } from './auth-middleware.js';

/**
 * Whether the request carries a signed-in session — and nothing whatever about whose.
 *
 * Route guards need the answer before a page renders, and `beforeLoad` has no React context to read
 * it from, so it has to come off the request itself. The return type is the narrowest thing that
 * answers the question: no id, no email, no role. A guard that returned the session would invite
 * callers to render from it, and every one of those would be a private field serialised into the
 * HTML of a page that already fetches its own data behind {@link requirePermission}.
 *
 * This is a routing convenience, not the access boundary. The boundary is on the server functions
 * that read the data; this only decides whether a visitor is sent to sign in first.
 */
export const hasAuthSession = createServerFn({ strict: false })
  .middleware([authMiddleware])
  .handler(({ context }) => context.session !== null);
