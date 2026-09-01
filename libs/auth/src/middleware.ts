import { AppError } from '@founders-coffee/core';
import { eq, type Db, user } from '@founders-coffee/db';

import type { AuthInstance } from './auth.js';
import type { Role } from './rbac.js';

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

/** Require a specific role (AGENTS.md §11.2 — authz in one place, never inline). */
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
