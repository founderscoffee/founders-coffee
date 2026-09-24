import { describe, expect, it } from 'vitest';

import { allRateBudgets, RATE_BUDGETS } from './rate-budgets.js';
import { PROFILE_READ_LIMIT, PROFILE_UPDATE_LIMIT } from './profile/schemas.js';

describe('rate budgets', () => {
  it('gives every budget a usable shape', () => {
    for (const budget of allRateBudgets()) {
      expect(budget.action).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(budget.limit).toBeGreaterThan(0);
      expect(budget.windowMs).toBeGreaterThanOrEqual(60_000);
    }
  });

  it('never lets two endpoints share one bucket name', () => {
    const actions = allRateBudgets().map((budget) => budget.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it('keeps an owner write scarcer than an anonymous read', () => {
    expect(RATE_BUDGETS.edit.profileUpdate.limit).toBeLessThan(
      RATE_BUDGETS.read.publicProfile.limit,
    );
  });

  it('is the only source the profile endpoints draw from', () => {
    expect(PROFILE_UPDATE_LIMIT).toBe(RATE_BUDGETS.edit.profileUpdate);
    expect(PROFILE_READ_LIMIT).toBe(RATE_BUDGETS.read.publicProfile);
  });

  it('declares the categories that later tickets must fill', () => {
    expect(Object.keys(RATE_BUDGETS).sort()).toEqual([
      'edit',
      'expensive',
      'otp',
      'read',
      'telegram',
    ]);
  });
});
