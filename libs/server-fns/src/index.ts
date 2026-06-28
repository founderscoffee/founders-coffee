/**
 * founders.coffee server-function foundation (AGENTS.md §7): the `createServerFn`
 * pattern, request-scoped logging, and authorization primitives that every feature
 * server-fn (P1-001+) builds on. Server functions are the throw boundary — they
 * unwrap the domain `Result` via `handleResult()` and throw the typed `AppError` on
 * failure so TanStack Query enters its error state automatically.
 */
export { getDb } from './db.js';
export { getPublicAuthConfig } from './auth-config.js';
export { withRequestContext, requestContextMiddleware } from './request-context.js';
export {
  checkPermission,
  requireAuth,
  type PermissionResource,
  type PermissionAction,
} from './authz.js';
export { getAuthEnv, resolveSession } from './auth.js';
export { authMiddleware, requirePermission } from './auth-middleware.js';
export * from './markets/index.js';
