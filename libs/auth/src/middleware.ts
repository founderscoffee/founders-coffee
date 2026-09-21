import { AppError } from '@founders-coffee/core';
import { eq, type Db, user } from '@founders-coffee/db';

import type { AuthInstance } from './auth.js';
import { roleAllows, type Role } from './rbac.js';

export type AuthSession = NonNullable<
  Awaited<ReturnType<AuthInstance['api']['getSession']>>
>;

/** Resolve the active session from request headers, or null if unauthenticated. */
export const getSession = async (
  auth: AuthInstance,
  headers: Headers,
): Promise<AuthSession | null> => auth.api.getSession({ headers });

/** Require an authenticated session; throw a typed AppError otherwise. */
export const requireSession = (session: AuthSession | null): AuthSession => {
  if (!session) {
    throw new AppError('unauthenticated', 'Authentication required');
  }
  return session;
};

/**
 * Require a specific role — an exact match, and rarely what you want.
 *
 * It refuses every role but the one named, so `requireRole(session, 'moderator')` turns an admin
 * away from an action an admin plainly may take. That is right only where the role *is* the subject,
 * and wrong wherever a capability is. Prefer {@link requirePermission}, which asks the central table
 * what a role may do rather than which role it is.
 */
export const requireRole = (
  session: AuthSession | null,
  role: Role,
): AuthSession => {
  const s = requireSession(session);
  if (s.user.role !== role) {
    throw new AppError('forbidden', `This action requires the '${role}' role`);
  }
  return s;
};

/**
 * Require that whoever is signed in may take this action.
 *
 * The check every admin server function is meant to make (AGENTS.md §10): the question is what the role may
 * do, asked once of the central table, and never which role it happens to be. A role added later
 * that carries the permission passes here without this call site being touched, which is the whole
 * argument for a permission table over a role comparison.
 */
export const requirePermission = (
  session: AuthSession | null,
  permission: Parameters<typeof roleAllows>[1],
): AuthSession => {
  const s = requireSession(session);
  if (!roleAllows(s.user.role, permission)) {
    throw new AppError('forbidden', 'This action requires an operator role');
  }
  return s;
};

/**
 * First-admin bootstrap: promote the user with the given email to `admin`.
 * Used at deploy (no `createUser` — passwordless). Safe to re-run (idempotent).
 */
export const ensureAdmin = async (db: Db, email: string): Promise<void> => {
  await db
    .update(user)
    .set({ role: 'admin' })
    .where(eq(user.email, email))
    .run();
};
