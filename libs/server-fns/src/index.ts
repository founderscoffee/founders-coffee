/**
 * founders.coffee server-function foundation (AGENTS.md §7): the `createServerFn` RPCs + authz
 * primitives. Server functions are the throw boundary — they unwrap the domain `Result` via
 * `handleResult()` and throw the typed `AppError` on failure so TanStack Query enters its error
 * state automatically.
 *
 * Client-facing barrel — only createServerFn RPCs (TanStack compiles these to client stubs), the
 * request-context middleware (for apps' `createStart`), and the pure authz helpers. The server-only
 * internals — `getDb`/`getAuthEnv`/`resolveSession` (import `cloudflare:workers`) and
 * `authMiddleware`/`requirePermission` (import `@tanstack/react-start/server`) — are intentionally
 * NOT re-exported here: they would drag unresolvable server imports into the browser bundle.
 * Authed server-fns import them directly from their modules (`./db`, `./auth-middleware`).
 */
export { getPublicAuthConfig } from './auth-config.js';
export { getGeoCountry } from './geo.js';
export { getCities, getFeaturedCities, getStates } from './geo-rpc.js';
export * from './events/index.js';
export { getMyProfile, getPublicProfile, setHomeLocation } from './profile.js';
export type { UserProfile, PublicProfile } from './profile.js';
export { withRequestContext, requestContextMiddleware } from './request-context.js';
export {
  checkPermission,
  requireAuth,
  type PermissionResource,
  type PermissionAction,
} from './authz.js';
export * from './markets/index.js';
