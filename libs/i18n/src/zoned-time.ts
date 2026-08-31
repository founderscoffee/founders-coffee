const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const wallClockFormatterCache = new Map<string, Intl.DateTimeFormat>();

const wallClockFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = wallClockFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  wallClockFormatterCache.set(timeZone, formatter);
  return formatter;
};

export type ZonedCalendarDate = {
  year: number;
  month: number;
  day: number;
};

export type ZonedWallClock = ZonedCalendarDate & {
  hour: number;
  minute: number;
};

type ZonedWallClockWithSeconds = ZonedWallClock & {
  second: number;
};

export type ZonedDateTimeError =
  'invalid_time_zone' | 'invalid_wall_time' | 'nonexistent_time';

export type ZonedDateTimeResolution =
  | {
      ok: true;
      epochMs: number;
      offsetMinutes: number;
      isAmbiguous: boolean;
    }
  | { ok: false; reason: ZonedDateTimeError };

export type ZonedTimeRangeResolution =
  | {
      ok: true;
      startsAt: number;
      endsAt: number;
      startOffsetMinutes: number;
      endOffsetMinutes: number;
      isStartAmbiguous: boolean;
      isEndAmbiguous: boolean;
    }
  | {
      ok: false;
      boundary: 'start' | 'end';
      reason: ZonedDateTimeError;
    };

const partNumber = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number => Number(parts.find((part) => part.type === type)?.value);

export const getZonedWallClock = (
  epochMs: number,
  timeZone: string,
): ZonedWallClockWithSeconds => {
  const parts = wallClockFormatter(timeZone).formatToParts(new Date(epochMs));
  return {
    year: partNumber(parts, 'year'),
    month: partNumber(parts, 'month'),
    day: partNumber(parts, 'day'),
    hour: partNumber(parts, 'hour'),
    minute: partNumber(parts, 'minute'),
    second: partNumber(parts, 'second'),
  };
};

const isValidWallClock = (wallClock: ZonedWallClock): boolean => {
  if (
    !Number.isInteger(wallClock.year) ||
    !Number.isInteger(wallClock.month) ||
    !Number.isInteger(wallClock.day) ||
    !Number.isInteger(wallClock.hour) ||
    !Number.isInteger(wallClock.minute) ||
    wallClock.year < 1970 ||
    wallClock.year > 9999 ||
    wallClock.month < 1 ||
    wallClock.month > 12 ||
    wallClock.day < 1 ||
    wallClock.day > 31 ||
    wallClock.hour < 0 ||
    wallClock.hour > 23 ||
    wallClock.minute < 0 ||
    wallClock.minute > 59
  ) {
    return false;
  }

  const normalized = new Date(
    Date.UTC(
      wallClock.year,
      wallClock.month - 1,
      wallClock.day,
      wallClock.hour,
      wallClock.minute,
    ),
  );
  return (
    normalized.getUTCFullYear() === wallClock.year &&
    normalized.getUTCMonth() === wallClock.month - 1 &&
    normalized.getUTCDate() === wallClock.day &&
    normalized.getUTCHours() === wallClock.hour &&
    normalized.getUTCMinutes() === wallClock.minute
  );
};

const sameWallClock = (
  actual: ZonedWallClockWithSeconds,
  expected: ZonedWallClock,
): boolean =>
  actual.year === expected.year &&
  actual.month === expected.month &&
  actual.day === expected.day &&
  actual.hour === expected.hour &&
  actual.minute === expected.minute &&
  actual.second === 0;

const offsetAt = (epochMs: number, timeZone: string): number => {
  const parts = getZonedWallClock(epochMs, timeZone);
  const wallClockAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const wholeSecondEpoch = Math.trunc(epochMs / 1000) * 1000;
  return wallClockAsUtc - wholeSecondEpoch;
};

/**
 * Resolve an IANA-zone wall clock to UTC. A DST gap is rejected. During a DST
 * overlap, the earlier of the two real instants is selected deterministically;
 * callers must show its numeric offset when asking the user to confirm.
 */
export const resolveZonedDateTime = (
  wallClock: ZonedWallClock,
  timeZone: string,
): ZonedDateTimeResolution => {
  if (!isValidWallClock(wallClock)) {
    return { ok: false, reason: 'invalid_wall_time' };
  }

  const wallClockAsUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
  );

  try {
    const probeOffsets = new Set(
      [
        -7 * DAY_MS,
        -2 * DAY_MS,
        -DAY_MS,
        0,
        DAY_MS,
        2 * DAY_MS,
        7 * DAY_MS,
      ].map((delta) => offsetAt(wallClockAsUtc + delta, timeZone)),
    );
    const candidates = [...probeOffsets]
      .map((offset) => wallClockAsUtc - offset)
      .filter((candidate, index, values) => values.indexOf(candidate) === index)
      .filter((candidate) =>
        sameWallClock(getZonedWallClock(candidate, timeZone), wallClock),
      )
      .sort((left, right) => left - right);

    const epochMs = candidates[0];
    if (epochMs === undefined) {
      return { ok: false, reason: 'nonexistent_time' };
    }

    return {
      ok: true,
      epochMs,
      offsetMinutes: (wallClockAsUtc - epochMs) / MINUTE_MS,
      isAmbiguous: candidates.length > 1,
    };
  } catch (error) {
    if (error instanceof RangeError) {
      return { ok: false, reason: 'invalid_time_zone' };
    }
    throw error;
  }
};

const parseTime = (value: string): { hour: number; minute: number } | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
};

const addCalendarDay = (date: ZonedCalendarDate): ZonedCalendarDate => {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

export const resolveZonedTimeRange = (
  date: ZonedCalendarDate,
  from: string,
  to: string,
  timeZone: string,
): ZonedTimeRangeResolution => {
  const startTime = parseTime(from);
  const endTime = parseTime(to);
  if (!startTime) {
    return { ok: false, boundary: 'start', reason: 'invalid_wall_time' };
  }
  if (!endTime) {
    return { ok: false, boundary: 'end', reason: 'invalid_wall_time' };
  }

  const start = resolveZonedDateTime({ ...date, ...startTime }, timeZone);
  if (!start.ok) {
    return { ok: false, boundary: 'start', reason: start.reason };
  }

  const startMinute = startTime.hour * 60 + startTime.minute;
  const endMinute = endTime.hour * 60 + endTime.minute;
  const endDate = endMinute < startMinute ? addCalendarDay(date) : date;
  const end = resolveZonedDateTime({ ...endDate, ...endTime }, timeZone);
  if (!end.ok) {
    return { ok: false, boundary: 'end', reason: end.reason };
  }

  return {
    ok: true,
    startsAt: start.epochMs,
    endsAt: end.epochMs,
    startOffsetMinutes: start.offsetMinutes,
    endOffsetMinutes: end.offsetMinutes,
    isStartAmbiguous: start.isAmbiguous,
    isEndAmbiguous: end.isAmbiguous,
  };
};
