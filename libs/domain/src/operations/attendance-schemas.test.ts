import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import { anAccountId } from './accounts.fixtures.js';

import {
  correctAttendanceSchema,
  operationsVersionSchema,
  recordAttendanceBatchSchema,
  recordAttendanceSchema,
  walkInCountSchema,
  WALK_IN_MAX,
} from './schemas.js';

const EVENT = id('evt');
const MEMBER = anAccountId();

describe('recordAttendanceSchema', () => {
  it('takes an event, a member and an outcome', () => {
    expect(
      recordAttendanceSchema.safeParse({
        eventId: EVENT,
        userId: MEMBER,
        outcome: 'attended',
      }).success,
    ).toBe(true);
  });

  it('refuses an outcome outside the two that exist', () => {
    expect(
      recordAttendanceSchema.safeParse({
        eventId: EVENT,
        userId: MEMBER,
        outcome: 'maybe',
      }).success,
    ).toBe(false);
  });

  it('offers no way to name a walk-in, because §5.4 forbids inventing one', () => {
    expect(
      recordAttendanceSchema.safeParse({
        eventId: EVENT,
        userId: MEMBER,
        outcome: 'attended',
        displayName: 'Someone at the next table',
      }).success,
    ).toBe(false);
  });

  it('refuses an id that is not one of ours', () => {
    expect(
      recordAttendanceSchema.safeParse({
        eventId: 'not-an-id',
        userId: MEMBER,
        outcome: 'attended',
      }).success,
    ).toBe(false);
  });
});

describe('recordAttendanceBatchSchema', () => {
  const outcome = { userId: MEMBER, outcome: 'attended' as const };

  it('takes a host marking a whole list at once', () => {
    expect(
      recordAttendanceBatchSchema.safeParse({
        eventId: EVENT,
        outcomes: [outcome, { userId: anAccountId(1), outcome: 'no_show' }],
      }).success,
    ).toBe(true);
  });

  it('refuses an empty list, which is not a submission', () => {
    expect(
      recordAttendanceBatchSchema.safeParse({ eventId: EVENT, outcomes: [] })
        .success,
    ).toBe(false);
  });

  it('is bounded, so one request cannot be a whole market', () => {
    expect(
      recordAttendanceBatchSchema.safeParse({
        eventId: EVENT,
        outcomes: Array.from({ length: 201 }, () => outcome),
      }).success,
    ).toBe(false);
  });
});

describe('correctAttendanceSchema', () => {
  it('requires a reason where recording does not', () => {
    const change = { eventId: EVENT, userId: MEMBER, outcome: 'no_show' };

    expect(recordAttendanceSchema.safeParse(change).success).toBe(true);
    expect(correctAttendanceSchema.safeParse(change).success).toBe(false);
    expect(
      correctAttendanceSchema.safeParse({ ...change, reason: 'member_dispute' })
        .success,
    ).toBe(true);
  });

  it('refuses a reason outside the locked list', () => {
    expect(
      correctAttendanceSchema.safeParse({
        eventId: EVENT,
        userId: MEMBER,
        outcome: 'no_show',
        reason: 'they asked nicely',
      }).success,
    ).toBe(false);
  });
});

describe('the bounded numbers', () => {
  it('accepts a plausible walk-in count', () => {
    expect(walkInCountSchema.parse(12)).toBe(12);
    expect(walkInCountSchema.parse(0)).toBe(0);
  });

  it('refuses a negative turnout, which is a typo and not a correction', () => {
    expect(walkInCountSchema.safeParse(-1).success).toBe(false);
  });

  it('refuses a turnout no café could hold', () => {
    expect(walkInCountSchema.safeParse(WALK_IN_MAX).success).toBe(true);
    expect(walkInCountSchema.safeParse(WALK_IN_MAX + 1).success).toBe(false);
  });

  it('refuses a fractional headcount', () => {
    expect(walkInCountSchema.safeParse(3.5).success).toBe(false);
  });

  it('takes a version from zero upward and nothing below', () => {
    expect(operationsVersionSchema.parse(0)).toBe(0);
    expect(operationsVersionSchema.safeParse(-1).success).toBe(false);
    expect(operationsVersionSchema.safeParse(1.5).success).toBe(false);
  });
});
