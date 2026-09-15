import { describe, expect, it } from 'vitest';

import type { EventTiming } from './windows.js';
import {
  CLOSEOUT_OVERDUE_AFTER_MS,
  FEEDBACK_CLOSES_AFTER_MS,
  FEEDBACK_INVITE_WITHIN_MS,
  canCloseOut,
  feedbackWindowOpen,
  invitesFeedback,
  isCloseoutOverdue,
  marketMonthOf,
} from './windows.js';

const ENDED = Date.UTC(2026, 8, 1, 18, 0);
const published = (endsAt: number | null): EventTiming => ({
  endsAt,
  status: 'published',
});

describe('canCloseOut', () => {
  it('allows it once the event has ended', () => {
    expect(canCloseOut(published(ENDED), ENDED + 1000)).toBe(true);
  });

  it('allows it at the exact end instant, which has passed', () => {
    expect(canCloseOut(published(ENDED), ENDED)).toBe(true);
  });

  it('refuses while the event is still running', () => {
    expect(canCloseOut(published(ENDED), ENDED - 1000)).toBe(false);
  });

  it('refuses a cancelled event, whose outcome its status already carries', () => {
    expect(
      canCloseOut({ endsAt: ENDED, status: 'cancelled' }, ENDED + 1000),
    ).toBe(false);
  });

  it('refuses a legacy event with no end time rather than inferring one', () => {
    expect(canCloseOut(published(null), ENDED + 1000)).toBe(false);
  });
});

describe('isCloseoutOverdue', () => {
  it('is quiet for the first day after the event', () => {
    expect(
      isCloseoutOverdue(
        published(ENDED),
        false,
        ENDED + CLOSEOUT_OVERDUE_AFTER_MS,
      ),
    ).toBe(false);
  });

  it('speaks up once a day has passed', () => {
    expect(
      isCloseoutOverdue(
        published(ENDED),
        false,
        ENDED + CLOSEOUT_OVERDUE_AFTER_MS + 1,
      ),
    ).toBe(true);
  });

  it('says nothing about an event already closed out', () => {
    expect(
      isCloseoutOverdue(published(ENDED), true, ENDED + 10 * 86_400_000),
    ).toBe(false);
  });

  it('says nothing about a cancelled event', () => {
    expect(
      isCloseoutOverdue(
        { endsAt: ENDED, status: 'cancelled' },
        false,
        ENDED + 10 * 86_400_000,
      ),
    ).toBe(false);
  });

  it('says nothing about an event with no end time', () => {
    expect(isCloseoutOverdue(published(null), false, ENDED)).toBe(false);
  });
});

describe('invitesFeedback', () => {
  it('invites when a held event is closed out inside seven days', () => {
    expect(
      invitesFeedback('held', ENDED, ENDED + FEEDBACK_INVITE_WITHIN_MS),
    ).toBe(true);
  });

  it('invites nobody on a late closeout', () => {
    expect(
      invitesFeedback('held', ENDED, ENDED + FEEDBACK_INVITE_WITHIN_MS + 1),
    ).toBe(false);
  });

  it('invites nobody for a meetup that did not happen', () => {
    expect(invitesFeedback('did_not_happen', ENDED, ENDED + 1000)).toBe(false);
  });
});

describe('feedbackWindowOpen', () => {
  it('is open until fourteen days after the event', () => {
    expect(feedbackWindowOpen(ENDED, ENDED + FEEDBACK_CLOSES_AFTER_MS)).toBe(
      true,
    );
  });

  it('closes on the fourteenth day', () => {
    expect(
      feedbackWindowOpen(ENDED, ENDED + FEEDBACK_CLOSES_AFTER_MS + 1),
    ).toBe(false);
  });

  it('is anchored to the event, so a late closeout cannot reopen it', () => {
    const lateCloseout = ENDED + FEEDBACK_INVITE_WITHIN_MS;
    const fifteenDaysOut = ENDED + FEEDBACK_CLOSES_AFTER_MS + 86_400_000;

    expect(invitesFeedback('held', ENDED, lateCloseout)).toBe(true);
    expect(feedbackWindowOpen(ENDED, fifteenDaysOut)).toBe(false);
  });
});

describe('marketMonthOf', () => {
  it('groups by the market month, not the UTC one', () => {
    const lastNightOfAugust = Date.UTC(2026, 7, 31, 23, 30);

    expect(marketMonthOf(lastNightOfAugust, 'Africa/Algiers')).toBe('2026-09');
    expect(marketMonthOf(lastNightOfAugust, 'UTC')).toBe('2026-08');
  });

  it('formats as a zero-padded YYYY-MM', () => {
    expect(marketMonthOf(Date.UTC(2026, 0, 15), 'Africa/Algiers')).toBe(
      '2026-01',
    );
  });
});
