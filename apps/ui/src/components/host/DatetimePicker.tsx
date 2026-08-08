import { useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { arDZ, enUS, fr } from 'react-day-picker/locale'

import { host_time, type Locale } from '@founders-coffee/i18n'

import { TimePicker } from './TimePicker'

/** Map the app locale to a react-day-picker locale. Algeria-first → `arDZ` (Algerian Arabic). */
const DAYPICKER_LOCALE = { ar: arDZ, en: enUS, fr } as const
const DAYPICKER_DIR = { ar: 'rtl', en: 'ltr', fr: 'ltr' } as const

const pad = (n: number) => String(n).padStart(2, '0')
const toHHMM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Combine a calendar date + from/to "HH:MM" into local epochs (ms). */
const combineRange = (
  date: Date | undefined,
  from: string,
  to: string,
): { startsAt: number | null; endsAt: number | null } => {
  if (!date) return { startsAt: null, endsAt: null }
  const [fh, fm] = from.split(':').map(Number)
  const [th, tm] = to.split(':').map(Number)
  const start = new Date(date)
  start.setHours(fh || 0, fm || 0, 0, 0)
  const end = new Date(date)
  end.setHours(th || 0, tm || 0, 0, 0)
  return { startsAt: start.getTime(), endsAt: end.getTime() }
}

type DatetimePickerProps = {
  startsAt: number | null
  endsAt: number | null
  onChange: (startsAt: number | null, endsAt: number | null) => void
  locale: Locale
  /**
   * `top` — time control sits above the calendar card (step 2 wizard layout).
   * `bottom` — time control sits under the calendar inside the parent card.
   */
  timePlacement?: 'top' | 'bottom'
}

/**
 * Date (react-day-picker) + time RANGE (timepicker-ui) picker. The calendar picks the day, the range
 * picker picks the start→end window; together they produce startsAt + endsAt (the event's ends_at
 * column). Both are React-friendly (the timepicker is wrapped imperatively in `TimePicker`, kept
 * client-only by this component's `React.lazy` boundary). The initial values seed both at mount; the
 * wizard remounts step content via `key={step}`, so navigating back restores the pick. Past dates are
 * disabled; the date displays in `Africa/Algiers` but the epoch uses the browser's local zone.
 */
export const DatetimePicker = ({
  startsAt,
  endsAt,
  onChange,
  locale,
  timePlacement = 'bottom',
}: DatetimePickerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => (startsAt ? new Date(startsAt) : undefined))
  const [fromTime, setFromTime] = useState(() => (startsAt ? toHHMM(new Date(startsAt)) : '18:00'))
  const [toTime, setToTime] = useState(() => (endsAt ? toHHMM(new Date(endsAt)) : '19:00'))
  const selectedDateRef = useRef(selectedDate)
  selectedDateRef.current = selectedDate
  const fromTimeRef = useRef(fromTime)
  fromTimeRef.current = fromTime
  const toTimeRef = useRef(toTime)
  toTimeRef.current = toTime

  const handleDate = (d: Date | undefined) => {
    setSelectedDate(d)
    selectedDateRef.current = d
    const next = combineRange(d, fromTimeRef.current, toTimeRef.current)
    onChange(next.startsAt, next.endsAt)
  }
  const handleRange = (from: string, to: string) => {
    setFromTime(from)
    setToTime(to)
    fromTimeRef.current = from
    toTimeRef.current = to
    const next = combineRange(selectedDateRef.current, from, to)
    onChange(next.startsAt, next.endsAt)
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const timeControl = (
    <label className="form-control shrink-0">
      <span className="mb-1 block text-sm text-base-content/70">{host_time({}, { locale })}</span>
      <TimePicker from={fromTime} to={toTime} onChange={handleRange} locale={locale} />
    </label>
  )

  const calendar = (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
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
        timeZone="Africa/Algiers"
        selected={selectedDate}
        onSelect={handleDate}
        disabled={{ before: startOfToday }}
      />
    </div>
  )

  if (timePlacement === 'top') {
    return (
      <div className="flex flex-col gap-3">
        {timeControl}
        <div className="flex h-[400px] flex-col rounded-[1.25rem] border border-base-300/60 bg-base-100/70 p-5 shadow-xl shadow-base-content/5 backdrop-blur-md md:p-6">
          {calendar}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {calendar}
      {timeControl}
    </div>
  )
}
