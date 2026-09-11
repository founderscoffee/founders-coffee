import { describe, expect, it } from 'vitest';

import { requirePermission, requireRole } from './middleware.js';
import { ADMIN_APP_PERMISSION, roleAllows, roles } from './rbac.js';

const OPERATOR_ACTIONS = [
  { operations: ['read'] },
  { metrics: ['read'] },
  { moderation: ['event'] },
  { moderation: ['user'] },
  { host_trust: ['update'] },
  { audit: ['read'] },
] as const;

describe('the seven operations actions §5.12 requires', () => {
  it('gives an admin every one of them', () => {
    for (const action of [...OPERATOR_ACTIONS, { closeout: ['override'] }])
      expect(roleAllows('admin', action)).toBe(true);
  });

  it('gives a moderator all but the closeout override', () => {
    for (const action of OPERATOR_ACTIONS)
      expect(roleAllows('moderator', action)).toBe(true);
  });

  it('withholds the closeout override from a moderator', () => {
    expect(roleAllows('moderator', { closeout: ['override'] })).toBe(false);
  });
});

describe('roles that are not operators', () => {
  it.each(['member', 'host', 'sponsor_contact'])(
    'refuses %s the admin app itself',
    (role) => {
      expect(roleAllows(role, ADMIN_APP_PERMISSION)).toBe(false);
    },
  );

  it.each(['member', 'host', 'sponsor_contact'])(
    'refuses %s every operations action',
    (role) => {
      for (const action of OPERATOR_ACTIONS)
        expect(roleAllows(role, action)).toBe(false);
    },
  );

  it('keeps what those roles already had', () => {
    expect(roleAllows('host', { event: ['create'] })).toBe(true);
    expect(roleAllows('member', { rsvp: ['create'] })).toBe(true);
  });
});

describe('a role the code does not define', () => {
  it.each([null, undefined, '', 'superuser', 'ADMIN'])(
    'refuses %s rather than reading it as absent',
    (role) => {
      expect(roleAllows(role, ADMIN_APP_PERMISSION)).toBe(false);
    },
  );

  it('cannot be reached by a property every object has', () => {
    expect(roleAllows('constructor', ADMIN_APP_PERMISSION)).toBe(false);
    expect(roleAllows('toString', ADMIN_APP_PERMISSION)).toBe(false);
  });
});

describe('the table itself', () => {
  it('names exactly the roles the product has', () => {
    expect(Object.keys(roles).sort()).toEqual([
      'admin',
      'host',
      'member',
      'moderator',
      'sponsor_contact',
    ]);
  });
});

describe('requirePermission, the check an admin server function makes', () => {
  const sessionFor = (role: string) =>
    ({ user: { role } }) as unknown as Parameters<typeof requirePermission>[0];

  it('admits an admin to an action a moderator also has', () => {
    expect(() =>
      requirePermission(sessionFor('admin'), { moderation: ['user'] }),
    ).not.toThrow();
  });

  it('is where requireRole would have been wrong', () => {
    expect(() => requireRole(sessionFor('admin'), 'moderator')).toThrow();
    expect(() =>
      requirePermission(sessionFor('admin'), { moderation: ['user'] }),
    ).not.toThrow();
  });

  it('refuses a member', () => {
    expect(() =>
      requirePermission(sessionFor('member'), { operations: ['read'] }),
    ).toThrow();
  });

  it('refuses nobody at all', () => {
    expect(() => requirePermission(null, { operations: ['read'] })).toThrow();
  });
});
