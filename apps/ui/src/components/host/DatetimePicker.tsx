import { useRef, useState } from 'react';
import { DayPicker, TZDate } from 'react-day-picker';

import {
  getZonedWallClock,
  host_time,
  resolveZonedTimeRange,
  type Locale,
  type ZonedDateTimeError,
} from '@founders-coffee/i18n';

import { DAYPICKER_LOCALE } from './daypicker-locale';
import { TimePicker } from './TimePicker';

const DAYPICKER_DIR = { ar: 'rtl', en: 'ltr', fr: 'ltr' } as const;

const pad = (n: number) => String(n).padStart(2, '0');
const toHHMM = (epochMs: number, timeZone: string) => {
  const wallClock = getZonedWallClock(epochMs, timeZone);
  return `${pad(wallClock.hour)}:${pad(wallClock.minute)}`;
};

const combineRange = (
  date: Date | undefined,
  from: string,
  to: string,
  timeZone: string,
):
  | { ok: true; startsAt: number | null; endsAt: number | null }
  | { ok: false; reason: ZonedDateTimeError } => {
  if (!date) return { ok: true, startsAt: null, endsAt: null };
  const result = resolveZonedTimeRange(
    {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    },
    from,
    to,
    timeZone,
  );
  return result.ok
    ? {
        ok: true,
        startsAt: result.startsAt,
        endsAt: result.endsAt,
      }
    : { ok: false, reason: result.reason };
};

type DatetimePickerProps = {
  startsAt: number | null;
  endsAt: number | null;
  onChange: (startsAt: number | null, endsAt: number | null) => void;
  onError: (error: ZonedDateTimeError | null) => void;
  locale: Locale;
  timeZone: string;
  timePlacement?: 'top' | 'bottom';
};

export const DatetimePicker = ({
  startsAt,
  endsAt,
  onChange,
  onError,
  locale,
  timeZone,
  timePlacement = 'bottom',
}: DatetimePickerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() =>
    startsAt ? new TZDate(startsAt, timeZone) : undefined,
  );
  const [fromTime, setFromTime] = useState(() =>
    startsAt ? toHHMM(startsAt, timeZone) : '18:00',
  );
  const [toTime, setToTime] = useState(() =>
    endsAt ? toHHMM(endsAt, timeZone) : '19:00',
  );
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const fromTimeRef = useRef(fromTime);
  fromTimeRef.current = fromTime;
  const toTimeRef = useRef(toTime);
  toTimeRef.current = toTime;

  const handleDate = (d: Date | undefined) => {
    setSelectedDate(d);
    selectedDateRef.current = d;
    const next = combineRange(
      d,
      fromTimeRef.current,
      toTimeRef.current,
      timeZone,
    );
    if (!next.ok) {
      onChange(null, null);
      onError(next.reason);
      return;
    }
    onError(null);
    onChange(next.startsAt, next.endsAt);
  };
  const handleRange = (from: string, to: string) => {
    setFromTime(from);
    setToTime(to);
    fromTimeRef.current = from;
    toTimeRef.current = to;
    const next = combineRange(selectedDateRef.current, from, to, timeZone);
    if (!next.ok) {
      onChange(null, null);
      onError(next.reason);
      return;
    }
    onError(null);
    onChange(next.startsAt, next.endsAt);
  };

  const today = new TZDate(Date.now(), timeZone);

  const timeControl = (
    <label className="form-control shrink-0">
      <span className="mb-1 block text-body-sm text-neutral">
        {host_time({}, { locale })}
      </span>
      <TimePicker
        from={fromTime}
        to={toTime}
        onChange={handleRange}
        locale={locale}
      />
    </label>
  );

  const calendar = (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
      <DayPicker
        className="react-day-picker host-daypicker"
        mode="single"
        animate
        dir={DAYPICKER_DIR[locale]}
        locale={DAYPICKER_LOCALE[locale]}
        numerals="latn"
        firstWeekContainsDate={1}
        numberOfMonths={1}
        showOutsideDays
        timeZone={timeZone}
        today={today}
        defaultMonth={selectedDate}
        selected={selectedDate}
        onSelect={handleDate}
        disabled={{ before: today }}
      />
    </div>
  );

  if (timePlacement === 'top') {
    return (
      <div className="flex flex-col gap-4">
        {timeControl}
        {calendar}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {calendar}
      {timeControl}
    </div>
  );
};
