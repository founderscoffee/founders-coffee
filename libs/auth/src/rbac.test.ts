import { describe, expect, it } from 'vitest';

import { roles, type Role } from './rbac.js';

describe('libs/auth RBAC', () => {
  it('defines exactly the five system roles (FR-A5)', () => {
    expect(Object.keys(roles).sort()).toEqual([
      'admin',
      'host',
      'member',
      'moderator',
      'sponsor_contact',
    ]);
  });

  it('every Role value resolves to a configured role', () => {
    const all: Role[] = [
      'member',
      'host',
      'sponsor_contact',
      'moderator',
      'admin',
    ];
    for (const r of all) {
      expect(roles[r]).toBeTruthy();
    }
  });
});
