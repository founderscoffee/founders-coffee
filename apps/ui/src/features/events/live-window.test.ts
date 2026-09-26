import { describe, expect, it } from 'vitest';

import {
  eventPhase,
  isLiveWindowOpen,
  LIVE_WINDOW_LEAD_MS,
} from './live-window';

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

describe('eventPhase', () => {
  it('is upcoming until the start', () => {
    expect(eventPhase(START, END, START - 1)).toBe('upcoming');
  });

  it('has started from the start, the moment the server stops taking RSVPs', () => {
    expect(eventPhase(START, END, START)).toBe('started');
    expect(eventPhase(START, END, END)).toBe('started');
  });

  it('has ended once the end is past, when the live room closes too', () => {
    expect(eventPhase(START, END, END + 1)).toBe('ended');
    expect(isLiveWindowOpen(START, END, END + 1)).toBe(false);
  });

  it('gives a meetup with no recorded end two hours, as the live room does', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    expect(eventPhase(START, null, START + twoHours)).toBe('started');
    expect(eventPhase(START, null, START + twoHours + 1)).toBe('ended');
  });

  it('reads the start and end as Dates too', () => {
    expect(eventPhase(new Date(START), new Date(END), END + 1)).toBe('ended');
  });

  it('treats an unreadable start as still to come', () => {
    expect(eventPhase(Number.NaN, END, START)).toBe('upcoming');
  });
});
