import { describe, expect, it } from 'vitest';

import { isLiveWindowOpen, LIVE_WINDOW_LEAD_MS } from './live-window';

const START = Date.parse('2026-09-17T18:00:00Z');
const END = Date.parse('2026-09-17T20:00:00Z');

describe('isLiveWindowOpen', () => {
  it('stays shut until an hour before the start', () => {
    expect(isLiveWindowOpen(START, END, START - LIVE_WINDOW_LEAD_MS - 1)).toBe(
      false,
    );
    expect(isLiveWindowOpen(START, END, START - LIVE_WINDOW_LEAD_MS)).toBe(
      true,
    );
  });

  it('stays open through the meetup and closes at the end', () => {
    expect(isLiveWindowOpen(START, END, START)).toBe(true);
    expect(isLiveWindowOpen(START, END, END)).toBe(true);
    expect(isLiveWindowOpen(START, END, END + 1)).toBe(false);
  });

  it('gives an event with no recorded end two hours to run', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    expect(isLiveWindowOpen(START, null, START + twoHours)).toBe(true);
    expect(isLiveWindowOpen(START, null, START + twoHours + 1)).toBe(false);
  });

  it('opens at the same instant wherever the viewer is', () => {
    const openingMoment = START - LIVE_WINDOW_LEAD_MS;

    expect(
      isLiveWindowOpen(new Date(START), new Date(END), openingMoment),
    ).toBe(true);
    expect(
      isLiveWindowOpen(
        new Date(START).toISOString() as unknown as number,
        END,
        openingMoment,
      ),
    ).toBe(true);
  });

  it('refuses to open on an unreadable start', () => {
    expect(isLiveWindowOpen(Number.NaN, END, START)).toBe(false);
  });
});
