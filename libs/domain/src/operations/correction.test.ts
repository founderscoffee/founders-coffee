import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import { correctCloseoutSchema } from './schemas.js';

const EVENT = id('evt');

describe('correctCloseoutSchema holds the same shape as the submission', () => {
  const correction = (overrides: Record<string, unknown> = {}) => ({
    eventId: EVENT,
    expectedVersion: 0,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    reason: 'data_entry_error',
    ...overrides,
  });

  it('accepts a plain correction', () => {
    expect(correctCloseoutSchema.safeParse(correction()).success).toBe(true);
  });

  it('refuses walk-ins on a meetup that did not happen', () => {
    expect(
      correctCloseoutSchema.safeParse(
        correction({ outcome: 'did_not_happen', walkInCount: 2 }),
      ).success,
    ).toBe(false);
  });

  it('requires the note behind the other-friction category, as submission does', () => {
    expect(
      correctCloseoutSchema.safeParse(
        correction({ hostFriction: ['other_structured'] }),
      ).success,
    ).toBe(false);
    expect(
      correctCloseoutSchema.safeParse(
        correction({
          hostFriction: ['other_structured'],
          privateNote: 'the terrace was closed',
        }),
      ).success,
    ).toBe(true);
  });
});
