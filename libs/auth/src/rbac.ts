import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

/**
 * RBAC — single source of truth for roles + permissions (AGENTS.md §11.2).
 *
 * Permissions are defined in code (the `statements` map); the DB stores only the
 * role string on `user.role`. A single role per user (decision: FR-A5, one role
 * at a time). `libs/auth` enforces permissions in one place; apps declare the
 * required permission per server-function and never inline checks.
 *
 * Statements start minimal (P0) and grow as domains land (events P1, challenges
 * P2, sponsorships P3). `defaultStatements` carries the user/session/impersonation
 * actions the `admin` plugin needs; `adminAc.statements` is the full admin grant.
 */
const statements = {
  ...defaultStatements,
  event: ['create', 'read'],
  rsvp: ['create', 'read', 'update'],
  sponsorship: ['read'],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  member: ac.newRole({ event: ['create', 'read'], rsvp: ['create', 'read', 'update'], sponsorship: ['read'] }),
  host: ac.newRole({ event: ['create', 'read'], rsvp: ['create', 'read', 'update'], sponsorship: ['read'] }),
  sponsor_contact: ac.newRole({ event: ['read'], rsvp: ['read'], sponsorship: ['read'] }),
  moderator: ac.newRole({ event: ['create', 'read'], rsvp: ['create', 'read', 'update'], sponsorship: ['read'] }),
  admin: ac.newRole({
    ...adminAc.statements,
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
  }),
} as const;

/** The five system roles (FR-A5). The DB column holds one of these as text. */
export type Role = keyof typeof roles;
