import { describe, expect, it } from 'vitest';

import { zonedIsoString } from './zoned-iso.js';

describe('an instant written in its market’s own time', () => {
  it.each([
    ['Africa/Algiers', '2026-09-30T18:00:00+01:00'],
    ['Africa/Cairo', '2026-09-30T20:00:00+03:00'],
    ['Asia/Riyadh', '2026-09-30T20:00:00+03:00'],
  ])('carries the %s offset beside the local time', (timeZone, expected) => {
    expect(zonedIsoString(Date.UTC(2026, 8, 30, 17, 0), timeZone)).toBe(
      expected,
    );
  });

  it('follows the offset across a clock change', () => {
    expect(
      zonedIsoString(Date.UTC(2026, 11, 15, 17, 0), 'Africa/Cairo'),
      'Cairo leaves summer time on the last Thursday of October, so December is two hours ahead, not three',
    ).toBe('2026-12-15T19:00:00+02:00');
  });

  it('writes a zero offset as +00:00 and drops the milliseconds', () => {
    expect(zonedIsoString(Date.UTC(2026, 8, 30, 17, 0, 5, 999), 'UTC')).toBe(
      '2026-09-30T17:00:05+00:00',
    );
  });

  it('writes an offset behind UTC with a minus sign and its minutes', () => {
    expect(
      zonedIsoString(Date.UTC(2026, 0, 15, 17, 0), 'America/St_Johns'),
    ).toBe('2026-01-15T13:30:00-03:30');
  });
});
