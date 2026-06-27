import { describe, expect, it } from 'vitest';

import { checkPermission, requireAuth, requirePermission } from './authz.js';
import { AppError } from '@founders-coffee/core';

describe('checkPermission', () => {
  it('allows a host to create events', () => {
    expect(checkPermission('host', 'event', 'create')).toBe(true);
  });

  it('denies a member from creating events', () => {
    expect(checkPermission('member', 'event', 'create')).toBe(false);
  });

  it('allows a member to read events', () => {
    expect(checkPermission('member', 'event', 'read')).toBe(true);
  });

  it('allows an admin to create events (wildcard/role grant)', () => {
    expect(checkPermission('admin', 'event', 'create')).toBe(true);
  });

  it('allows reading sponsorships for all roles', () => {
    expect(checkPermission('sponsor_contact', 'sponsorship', 'read')).toBe(true);
  });
});

const session = (role: string) => ({ user: { role } }) as never;

describe('requireAuth', () => {
  it('throws unauthenticated for a null session', () => {
    expect(() => requireAuth(null)).toThrowError(/Authentication/);
  });

  it('returns the session when authenticated', () => {
    const s = session('member');
    expect(requireAuth(s)).toBe(s);
  });
});

describe('requirePermission', () => {
  it('throws unauthenticated without a session', () => {
    expect(() => requirePermission(null, 'event', 'create')).toThrowError(AppError);
  });

  it('throws forbidden when the role lacks the permission', () => {
    expect(() => requirePermission(session('member'), 'event', 'create')).toThrowError(
      /Permission denied/,
    );
  });

  it('returns the session when the role has the permission', () => {
    const s = session('host');
    expect(requirePermission(s, 'event', 'create')).toBe(s);
  });
});
