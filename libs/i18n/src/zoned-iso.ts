import { getZonedWallClock } from './zoned-time.js';

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/**
 * An instant as ISO 8601 in `timeZone`'s own wall-clock time, with that zone's offset at the
 * instant: 18:00 in Algiers is `2026-09-30T18:00:00+01:00`, where `toISOString` says `17:00Z`.
 *
 * Both name the same moment, but a reader of the local form sees the hour the meetup is announced
 * at, which is how Google asks for event times to be given. Seconds are kept and milliseconds
 * dropped, since no schedule on the site is finer than a minute.
 */
export const zonedIsoString = (epochMs: number, timeZone: string): string => {
  const wall = getZonedWallClock(epochMs, timeZone);
  const wholeSecond = Math.floor(epochMs / 1000) * 1000;
  const offsetMinutes = Math.round(
    (Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    ) -
      wholeSecond) /
      60_000,
  );
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  return (
    `${wall.year}-${twoDigits(wall.month)}-${twoDigits(wall.day)}` +
    `T${twoDigits(wall.hour)}:${twoDigits(wall.minute)}:${twoDigits(wall.second)}` +
    `${sign}${twoDigits(Math.floor(absolute / 60))}:${twoDigits(absolute % 60)}`
  );
};
