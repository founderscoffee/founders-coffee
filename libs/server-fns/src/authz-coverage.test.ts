import { describe, expect, it } from 'vitest';

import { checkPermission } from './authz.js';
import { TURNSTILE_ACTIONS } from './turnstile/actions.js';

const AUTHENTICATED_ROLES = [
  'member',
  'host',
  'moderator',
  'admin',
  'sponsor_contact',
] as const;

describe('AR-06 authorization coverage', () => {
  it.each(AUTHENTICATED_ROLES)(
    '%s may update its own profile and manage its own push registrations',
    (role) => {
      expect(checkPermission(role, 'profile', 'update')).toBe(true);
      expect(checkPermission(role, 'push', 'manage')).toBe(true);
    },
  );

  it('keeps the new resources separate from the event and rsvp grants', () => {
    expect(checkPermission('sponsor_contact', 'event', 'create')).toBe(false);
    expect(checkPermission('sponsor_contact', 'rsvp', 'create')).toBe(false);
    expect(checkPermission('sponsor_contact', 'profile', 'update')).toBe(true);
  });

  it('pins a distinct Turnstile action per protected flow', () => {
    const actions = Object.values(TURNSTILE_ACTIONS);
    expect(new Set(actions).size).toBe(actions.length);
    expect(TURNSTILE_ACTIONS.joinWaitlist).not.toBe(
      TURNSTILE_ACTIONS.createEvent,
    );
  });
});
