import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { resolveSession } from './auth.js';
import {
  requirePermission as enforcePermission,
  type PermissionAction,
  type PermissionResource,
} from './authz.js';

/**
 * Attach the resolved session (null if anonymous) to the server-function context. Compose **per-fn**
 * that needs identity — NOT global, so public RPCs (e.g. the markets resolver) stay anonymous. Pairs
 * with {@link requirePermission} (the enforcer) on fns that touch private data.
 *
 * Kept in a separate module from [auth.ts](./auth.ts) because `@tanstack/react-start/server`
 * transitively loads `createStartHandler` (a vite-plugin virtual entry) which the vitest pool can't
 * resolve — so only this glue module carries that import; the pool-tested `resolveSession` stays clean.
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await resolveSession(getRequest().headers);
    return next({ context: { session } });
  },
);

/**
 * Server-function middleware factory: require an authenticated session whose role is granted
 * `action` on `resource` (throws `AppError('unauthenticated'|'forbidden')` otherwise). Compose on the
 * data-boundary server-fn — `createServerFn().middleware([requirePermission('event', 'create')])` —
 * the data boundary itself, not just a route guard (AGENTS §11.2). Depends on {@link authMiddleware}
 * for `context.session`.
 */
export const requirePermission = (
  resource: PermissionResource,
  action: PermissionAction,
) =>
  createMiddleware({ type: 'function' })
    .middleware([authMiddleware])
    .server(({ context, next }) => {
      enforcePermission(context.session, resource, action);
      return next();
    });
