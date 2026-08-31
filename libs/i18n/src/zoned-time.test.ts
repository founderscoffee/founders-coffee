import { describe, expect, it } from 'vitest';

import {
  getZonedWallClock,
  resolveZonedDateTime,
  resolveZonedTimeRange,
} from './zoned-time.js';

const wallClock = {
  year: 2026,
  month: 9,
  day: 15,
  hour: 18,
  minute: 30,
};

describe('IANA wall-clock conversion', () => {
  it.each([
    ['Africa/Algiers', 60],
    ['Africa/Cairo', 180],
    ['Asia/Riyadh', 180],
  ])('round-trips the configured %s market timezone', (timeZone, offset) => {
    const result = resolveZonedDateTime(wallClock, timeZone);
    expect(result).toEqual({
      ok: true,
      epochMs: Date.UTC(2026, 8, 15, 18, 30) - offset * 60_000,
      offsetMinutes: offset,
      isAmbiguous: false,
    });
    if (!result.ok) return;
    expect(getZonedWallClock(result.epochMs, timeZone)).toMatchObject(
      wallClock,
    );
  });

  it('does not use the host process timezone', () => {
    const processTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const marketTimeZone = ['Africa/Algiers', 'Asia/Riyadh'].find(
      (timeZone) => {
        const result = resolveZonedDateTime(wallClock, timeZone);
        return (
          result.ok &&
          getZonedWallClock(result.epochMs, processTimeZone).hour !==
            wallClock.hour
        );
      },
    );
    expect(marketTimeZone).toBeDefined();
    if (!marketTimeZone) return;

    const result = resolveZonedDateTime(wallClock, marketTimeZone);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getZonedWallClock(result.epochMs, marketTimeZone)).toMatchObject(
      wallClock,
    );
  });

  it('advances the end calendar day for a range crossing midnight', () => {
    const result = resolveZonedTimeRange(
      { year: 2026, month: 12, day: 31 },
      '23:30',
      '00:30',
      'Asia/Riyadh',
    );
    expect(result).toMatchObject({
      ok: true,
      startsAt: Date.UTC(2026, 11, 31, 20, 30),
      endsAt: Date.UTC(2026, 11, 31, 21, 30),
    });
  });

  it('rejects nonexistent wall clocks during a DST gap', () => {
    expect(
      resolveZonedDateTime(
        { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
        'America/New_York',
      ),
    ).toEqual({ ok: false, reason: 'nonexistent_time' });
  });

  it('selects the earlier instant during a DST overlap', () => {
    expect(
      resolveZonedDateTime(
        { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
        'America/New_York',
      ),
    ).toEqual({
      ok: true,
      epochMs: Date.UTC(2026, 10, 1, 5, 30),
      offsetMinutes: -240,
      isAmbiguous: true,
    });
  });

  it('rejects invalid calendar values, times, and IANA zones', () => {
    expect(
      resolveZonedDateTime(
        { year: 2026, month: 2, day: 30, hour: 12, minute: 0 },
        'Africa/Algiers',
      ),
    ).toEqual({ ok: false, reason: 'invalid_wall_time' });
    expect(
      resolveZonedTimeRange(
        { year: 2026, month: 9, day: 15 },
        '25:00',
        '26:00',
        'Africa/Algiers',
      ),
    ).toEqual({
      ok: false,
      boundary: 'start',
      reason: 'invalid_wall_time',
    });
    expect(resolveZonedDateTime(wallClock, 'Mars/Olympus')).toEqual({
      ok: false,
      reason: 'invalid_time_zone',
    });
  });
});
