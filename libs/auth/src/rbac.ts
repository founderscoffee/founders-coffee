import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

const statements = {
  ...defaultStatements,
  event: ['create', 'read'],
  rsvp: ['create', 'read', 'update'],
  sponsorship: ['read'],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  member: ac.newRole({
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
  }),
  host: ac.newRole({
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
  }),
  sponsor_contact: ac.newRole({
    event: ['read'],
    rsvp: ['read'],
    sponsorship: ['read'],
  }),
  moderator: ac.newRole({
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
  }),
} as const;

export type Role = keyof typeof roles;
