import { ac, type AuthSession, requireSession, type Role, roles } from '@founders-coffee/auth';
import { AppError } from '@founders-coffee/core';

type Statements = typeof ac.statements;

/** Permission resources, derived from the RBAC statements ([rbac.ts](../../auth/src/rbac.ts)). */
export type PermissionResource = keyof Statements;
/** Allowed action for a permission resource. */
export type PermissionAction = Statements[PermissionResource][number];

type AuthorizeRequest = Partial<Record<PermissionResource, PermissionAction[]>>;

const authorize = (role: Role, request: AuthorizeRequest): boolean => {
  const roleInstance = roles[role] as {
    authorize: (req: AuthorizeRequest) => { success: boolean };
  };
  return roleInstance.authorize(request).success;
};

/**
 * Whether `role` is granted `action` on `resource`, via the RBAC role map. Pure —
 * the single source of truth for authz decisions (AGENTS.md §11.2). Uses better-auth's
 * `authorize` so admin wildcards are honored (not a naive statement lookup).
 */
export const checkPermission = (
  role: Role,
  resource: PermissionResource,
  action: PermissionAction,
): boolean => {
  const request: AuthorizeRequest = {};
  request[resource] = [action];
  return authorize(role, request);
};

/** Require an authenticated session; throw `AppError('unauthenticated')` otherwise. */
export const requireAuth = (session: AuthSession | null): AuthSession =>
  requireSession(session);

/**
 * Require an authenticated session whose role is granted `action` on `resource`.
 * Throw `AppError('unauthenticated')` or `AppError('forbidden')` otherwise. Used by
 * the P1-017 `requirePermission` server-function middleware + handlers.
 */
export const requirePermission = (
  session: AuthSession | null,
  resource: PermissionResource,
  action: PermissionAction,
): AuthSession => {
  const authed = requireAuth(session);
  if (!checkPermission(authed.user.role as Role, resource, action)) {
    throw new AppError('forbidden', `Permission denied: ${resource}:${action}`);
  }
  return authed;
};
