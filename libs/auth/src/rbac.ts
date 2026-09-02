import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

const statements = {
  ...defaultStatements,
  event: ['create', 'read'],
  rsvp: ['create', 'read', 'update'],
  sponsorship: ['read'],
  profile: ['update'],
  push: ['manage'],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  member: ac.newRole({
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
    profile: ['update'],
    push: ['manage'],
  }),
  host: ac.newRole({
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
    profile: ['update'],
    push: ['manage'],
  }),
  sponsor_contact: ac.newRole({
    event: ['read'],
    rsvp: ['read'],
    sponsorship: ['read'],
    profile: ['update'],
    push: ['manage'],
  }),
  moderator: ac.newRole({
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
    profile: ['update'],
    push: ['manage'],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    event: ['create', 'read'],
    rsvp: ['create', 'read', 'update'],
    sponsorship: ['read'],
    profile: ['update'],
    push: ['manage'],
  }),
} as const;

export type Role = keyof typeof roles;
