import { describe, expect, it } from 'vitest';

import {
  fourWeekCover,
  hostAgainIntent,
  hostRetention60d,
  noShowRate,
  ratio,
  repeatParticipation,
  recurringHosts,
  returnIntent,
  rsvpToAttendance,
  totalAttendance,
} from './metrics.js';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 10);
const daysAgo = (days: number) => NOW - days * DAY;

describe('ratio', () => {
  it('reports the numbers it came from, not only the share', () => {
    expect(ratio(3, 4)).toEqual({ numerator: 3, denominator: 4, value: 0.75 });
  });

  it('is null on an empty denominator, because nobody was asked', () => {
    expect(ratio(0, 0).value).toBeNull();
  });

  it('distinguishes nobody asked from everybody said no', () => {
    expect(ratio(0, 0).value).toBeNull();
    expect(ratio(0, 5).value).toBe(0);
  });
});

describe('attendance rates', () => {
  it('divides attended by the outcomes recorded, not by the RSVPs', () => {
    expect(rsvpToAttendance({ attended: 7, noShow: 3 })).toMatchObject({
      numerator: 7,
      denominator: 10,
      value: 0.7,
    });
  });

  it('reports no-show as the complement over the same set', () => {
    expect(noShowRate({ attended: 7, noShow: 3 }).value).toBe(0.3);
  });

  it('says nothing about a closeout where no outcome was recorded', () => {
    expect(rsvpToAttendance({ attended: 0, noShow: 0 }).value).toBeNull();
    expect(noShowRate({ attended: 0, noShow: 0 }).value).toBeNull();
  });

  it('keeps walk-ins out of the rate and inside the total', () => {
    const tally = { attended: 7, noShow: 3 };

    expect(rsvpToAttendance(tally).denominator).toBe(10);
    expect(totalAttendance(tally, 5)).toBe(12);
  });

  it('cannot produce a rate above one however many walk in', () => {
    expect(rsvpToAttendance({ attended: 2, noShow: 0 }).value).toBe(1);
  });
});

describe('recurringHosts', () => {
  it('counts a host with two completed events inside ninety days', () => {
    expect(
      recurringHosts(
        [{ userId: 'a', completedAt: [daysAgo(10), daysAgo(40)] }],
        NOW,
      ),
    ).toBe(1);
  });

  it('does not count a host whose second event fell outside the window', () => {
    expect(
      recurringHosts(
        [{ userId: 'a', completedAt: [daysAgo(10), daysAgo(120)] }],
        NOW,
      ),
    ).toBe(0);
  });

  it('does not count a host with one event, however recent', () => {
    expect(
      recurringHosts([{ userId: 'a', completedAt: [daysAgo(1)] }], NOW),
    ).toBe(0);
  });
});

describe('hostRetention60d', () => {
  it('counts a host who came back inside sixty days of their first', () => {
    const result = hostRetention60d(
      [{ userId: 'a', completedAt: [daysAgo(100), daysAgo(60)] }],
      NOW,
    );

    expect(result).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
  });

  it('counts a host who has had the time and did not come back', () => {
    expect(
      hostRetention60d([{ userId: 'a', completedAt: [daysAgo(100)] }], NOW),
    ).toMatchObject({ numerator: 0, denominator: 1, value: 0 });
  });

  it('leaves out a host whose first event is too recent to judge', () => {
    expect(
      hostRetention60d([{ userId: 'a', completedAt: [daysAgo(10)] }], NOW),
    ).toMatchObject({ denominator: 0, value: null });
  });

  it('does not fall when the community recruits a new host', () => {
    const established = {
      userId: 'a',
      completedAt: [daysAgo(200), daysAgo(180)],
    };
    const before = hostRetention60d([established], NOW);

    const after = hostRetention60d(
      [established, { userId: 'b', completedAt: [daysAgo(3)] }],
      NOW,
    );

    expect(after.value).toBe(before.value);
  });

  it('measures the return against the first event, not the latest', () => {
    expect(
      hostRetention60d(
        [{ userId: 'a', completedAt: [daysAgo(300), daysAgo(5)] }],
        NOW,
      ).value,
    ).toBe(0);
  });
});

describe('repeatParticipation', () => {
  it('counts an attendee who came twice inside ninety days', () => {
    expect(
      repeatParticipation(
        [{ userId: 'a', attendedAt: [daysAgo(5), daysAgo(50)] }],
        NOW,
      ),
    ).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
  });

  it('counts a once-only attendee in the denominator alone', () => {
    expect(
      repeatParticipation([{ userId: 'a', attendedAt: [daysAgo(5)] }], NOW),
    ).toMatchObject({ numerator: 0, denominator: 1 });
  });

  it('leaves out someone who has not attended in the window at all', () => {
    expect(
      repeatParticipation([{ userId: 'a', attendedAt: [daysAgo(200)] }], NOW),
    ).toMatchObject({ denominator: 0, value: null });
  });

  it('is unaffected by walk-ins, which carry no identity to repeat', () => {
    const attendees = [{ userId: 'a', attendedAt: [daysAgo(5), daysAgo(20)] }];
    expect(repeatParticipation(attendees, NOW).value).toBe(1);
  });
});

describe('intent pulses', () => {
  it('reports the share and the response count together', () => {
    expect(returnIntent({ yes: 9, responses: 12 })).toMatchObject({
      numerator: 9,
      denominator: 12,
    });
  });

  it('says nothing when no host answered', () => {
    expect(hostAgainIntent({ yes: 0, responses: 0 }).value).toBeNull();
  });
});

describe('fourWeekCover', () => {
  it('compares the schedule with the operating target', () => {
    expect(fourWeekCover(8)).toEqual({
      scheduled: 8,
      target: 7,
      onTarget: true,
    });
  });

  it('says so when the next four weeks are thin', () => {
    expect(fourWeekCover(3).onTarget).toBe(false);
  });
});
