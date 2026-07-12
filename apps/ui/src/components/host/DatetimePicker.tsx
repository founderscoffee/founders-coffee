import { useState } from 'react'
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
}

/**
 * Date (react-day-picker) + time RANGE (timepicker-ui) picker. The calendar picks the day, the range
 * picker picks the start→end window; together they produce startsAt + endsAt (the event's ends_at
 * column). Both are React-friendly (the timepicker is wrapped imperatively in `TimePicker`, kept
 * client-only by this component's `React.lazy` boundary). The initial values seed both at mount; the
 * wizard remounts step content via `key={step}`, so navigating back restores the pick. Past dates are
 * disabled; the date displays in `Africa/Algiers` but the epoch uses the browser's local zone.
 */
export const DatetimePicker = ({ startsAt, endsAt, onChange, locale }: DatetimePickerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => (startsAt ? new Date(startsAt) : undefined))
  const [fromTime, setFromTime] = useState(() => (startsAt ? toHHMM(new Date(startsAt)) : '18:00'))
  const [toTime, setToTime] = useState(() => (endsAt ? toHHMM(new Date(endsAt)) : '19:00'))

  const handleDate = (d: Date | undefined) => {
    setSelectedDate(d)
    const next = combineRange(d, fromTime, toTime)
    onChange(next.startsAt, next.endsAt)
  }
  const handleRange = (from: string, to: string) => {
    setFromTime(from)
    setToTime(to)
    const next = combineRange(selectedDate, from, to)
    onChange(next.startsAt, next.endsAt)
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-3">
      <div className="flex justify-center overflow-x-auto">
        <DayPicker
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

      <label className="form-control">
        <span className="mb-1 block text-sm text-base-content/70">{host_time({}, { locale })}</span>
        <TimePicker from={fromTime} to={toTime} onChange={handleRange} locale={locale} />
      </label>
    </div>
  )
}
