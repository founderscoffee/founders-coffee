/**
 * founders.coffee server-function foundation (AGENTS.md §7): the `createServerFn` RPCs + authz
 * primitives. Server functions are the throw boundary — they unwrap the domain `Result` via
 * `handleResult()` and throw the typed `AppError` on failure so TanStack Query enters its error
 * state automatically.
 *
 * Client-facing barrel — only createServerFn RPCs (TanStack compiles these to client stubs) and the
 * pure authz helpers. The server-only internals — `getDb`/`getAuthEnv`/`resolveSession` (import
 * `cloudflare:workers`), `authMiddleware`/`requirePermission` (import `@tanstack/react-start/server`),
 * and `requestContextMiddleware`/`withRequestContext` (import `node:async_hooks` via
 * `@founders-coffee/observability/context`) — are intentionally NOT re-exported here: they would drag
 * unresolvable server imports into the browser bundle. App server entries (`start.ts`) import the
 * request-context middleware from the `@founders-coffee/server-fns/request-context` subpath.
 * Authed server-fns import the rest directly from their modules (`./db`, `./auth-middleware`).
 */
export { getPublicAuthConfig } from './auth-config.js';
export { getFirebaseConfig, getMapboxToken } from './config.js';
export { getGeoCountry } from './geo.js';
export {
  getCities,
  getCity,
  getFeaturedCities,
  getStates,
  searchCities,
} from './geo-rpc.js';
export * from './events/index.js';
export * from './maps/index.js';
export * from './rsvps/index.js';
export * from './waitlist/index.js';
export * from './notifications/index.js';
export * from './push/index.js';
export type { EventFeedPage } from './events/resolver.js';
export { getMyProfile, getPublicProfile, setHomeLocation } from './profile.js';
export type { UserProfile, PublicProfile } from './profile.js';
export {
  checkPermission,
  requireAuth,
  type PermissionResource,
  type PermissionAction,
} from './authz.js';
export * from './markets/index.js';
