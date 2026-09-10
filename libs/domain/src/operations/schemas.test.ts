import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import {
  correctCloseoutSchema,
  recordReviewSchema,
  submitCloseoutSchema,
  submitFeedbackSchema,
  updateHostTrustSchema,
  WALK_IN_MAX,
} from './schemas.js';
import { hostFrictionListSchema } from './enums.js';

const EVENT = id('evt');
const MEMBER = id('usr');

const closeout = (overrides: Record<string, unknown> = {}) => ({
  eventId: EVENT,
  outcome: 'held',
  ...overrides,
});

describe('submitCloseoutSchema', () => {
  it('defaults the optional pulse fields rather than requiring them', () => {
    const parsed = submitCloseoutSchema.parse(closeout());

    expect(parsed).toMatchObject({
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
    });
  });

  it('keeps "did not answer" distinct from "no"', () => {
    expect(submitCloseoutSchema.parse(closeout()).wouldHostAgain).toBeNull();
    expect(
      submitCloseoutSchema.parse(closeout({ wouldHostAgain: false }))
        .wouldHostAgain,
    ).toBe(false);
  });

  it('refuses a negative walk-in count, which is a typo and not a correction', () => {
    expect(
      submitCloseoutSchema.safeParse(closeout({ walkInCount: -1 })).success,
    ).toBe(false);
  });

  it('refuses a four-figure turnout at a café', () => {
    expect(
      submitCloseoutSchema.safeParse(closeout({ walkInCount: WALK_IN_MAX + 1 }))
        .success,
    ).toBe(false);
  });

  it('refuses walk-ins at a meetup that did not happen', () => {
    const result = submitCloseoutSchema.safeParse(
      closeout({ outcome: 'did_not_happen', walkInCount: 3 }),
    );

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.path).toEqual(['walkInCount']);
  });

  it('requires a private note behind the other-friction category', () => {
    expect(
      submitCloseoutSchema.safeParse(
        closeout({ hostFriction: ['other_structured'] }),
      ).success,
    ).toBe(false);
    expect(
      submitCloseoutSchema.safeParse(
        closeout({
          hostFriction: ['other_structured'],
          privateNote: 'the wifi',
        }),
      ).success,
    ).toBe(true);
  });

  it('rejects a friction category nobody agreed on', () => {
    expect(
      submitCloseoutSchema.safeParse(closeout({ hostFriction: ['weather'] }))
        .success,
    ).toBe(false);
  });
});

describe('hostFrictionListSchema', () => {
  it('counts a repeated category once', () => {
    expect(hostFrictionListSchema.parse(['venue', 'venue', 'safety'])).toEqual([
      'venue',
      'safety',
    ]);
  });

  it('accepts every category at once and no more', () => {
    const all = [
      'venue',
      'scheduling',
      'promotion',
      'attendance',
      'format',
      'safety',
      'other_structured',
    ];
    expect(hostFrictionListSchema.parse(all)).toHaveLength(7);
  });
});

describe('correctCloseoutSchema', () => {
  it('requires the version it is correcting', () => {
    expect(
      correctCloseoutSchema.safeParse({
        eventId: EVENT,
        outcome: 'held',
        walkInCount: 0,
        wouldHostAgain: null,
        hostFriction: [],
        reason: 'data_entry_error',
      }).success,
    ).toBe(false);
  });

  it('requires a reason, so no correction is anonymous in the audit', () => {
    expect(
      correctCloseoutSchema.safeParse({
        eventId: EVENT,
        expectedVersion: 0,
        outcome: 'held',
        walkInCount: 0,
        wouldHostAgain: null,
        hostFriction: [],
      }).success,
    ).toBe(false);
  });

  it('rejects a reason outside the locked list', () => {
    expect(
      correctCloseoutSchema.safeParse({
        eventId: EVENT,
        expectedVersion: 0,
        outcome: 'held',
        walkInCount: 0,
        wouldHostAgain: null,
        hostFriction: [],
        reason: 'because',
      }).success,
    ).toBe(false);
  });
});

describe('submitFeedbackSchema', () => {
  const pulse = (overrides: Record<string, unknown> = {}) => ({
    eventId: EVENT,
    rating: 'valuable',
    wouldReturn: true,
    ...overrides,
  });

  it('takes the three answers with no comment at all', () => {
    expect(submitFeedbackSchema.safeParse(pulse()).success).toBe(true);
  });

  it('requires the language a comment was written in', () => {
    const result = submitFeedbackSchema.safeParse(pulse({ comment: 'رائع' }));

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.path).toEqual(['commentLanguage']);
  });

  it('refuses a language with nothing for it to describe', () => {
    expect(
      submitFeedbackSchema.safeParse(pulse({ commentLanguage: 'ar' })).success,
    ).toBe(false);
  });

  it('treats a whitespace-only comment as no comment', () => {
    const parsed = submitFeedbackSchema.parse(pulse({ comment: '   ' }));
    expect(parsed.comment).toBeUndefined();
  });

  it('accepts a comment with its language', () => {
    const parsed = submitFeedbackSchema.parse(
      pulse({ comment: 'Très bien', commentLanguage: 'fr' }),
    );
    expect(parsed).toMatchObject({
      comment: 'Très bien',
      commentLanguage: 'fr',
    });
  });
});

describe('updateHostTrustSchema', () => {
  const trust = (overrides: Record<string, unknown> = {}) => ({
    marketCode: 'DZ',
    userId: MEMBER,
    status: 'verified',
    ...overrides,
  });

  it('allows verifying a host without a reason', () => {
    expect(updateHostTrustSchema.safeParse(trust()).success).toBe(true);
  });

  it('refuses to restrict one without recording why', () => {
    expect(
      updateHostTrustSchema.safeParse(trust({ status: 'restricted' })).success,
    ).toBe(false);
  });

  it('restricts with a reason', () => {
    expect(
      updateHostTrustSchema.safeParse(
        trust({ status: 'restricted', reason: 'safety' }),
      ).success,
    ).toBe(true);
  });
});

describe('recordReviewSchema', () => {
  const review = (overrides: Record<string, unknown> = {}) => ({
    marketCode: 'DZ',
    windowStart: 1,
    windowEnd: 2,
    bottleneck: 'host_supply',
    intervention: 'Ask two past hosts to run September',
    ownerUserId: MEMBER,
    dueAt: 3,
    ...overrides,
  });

  it('records a market-wide review with no geography', () => {
    const parsed = recordReviewSchema.parse(review());
    expect(parsed).toMatchObject({ stateCode: null, cityCode: null });
  });

  it('refuses a window that ends before it starts', () => {
    expect(
      recordReviewSchema.safeParse(review({ windowStart: 5, windowEnd: 2 }))
        .success,
    ).toBe(false);
  });

  it('refuses a city scope with no state behind it', () => {
    expect(
      recordReviewSchema.safeParse(review({ cityCode: '1' })).success,
    ).toBe(false);
  });

  it('refuses a bottleneck outside the locked list', () => {
    expect(
      recordReviewSchema.safeParse(review({ bottleneck: 'vibes' })).success,
    ).toBe(false);
  });

  it('refuses an empty intervention, which is not a decision', () => {
    expect(
      recordReviewSchema.safeParse(review({ intervention: '   ' })).success,
    ).toBe(false);
  });
});
