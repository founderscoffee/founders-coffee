import { Clock } from 'lucide-react'
import { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { arDZ, enUS, fr } from 'react-day-picker/locale'

import { host_time, type Locale } from '@founders-coffee/i18n'

/** Map the app locale to a react-day-picker locale. Algeria-first → `arDZ` (Algerian Arabic). */
const DAYPICKER_LOCALE = { ar: arDZ, en: enUS, fr } as const
const DAYPICKER_DIR = { ar: 'rtl', en: 'ltr', fr: 'ltr' } as const

const pad = (n: number) => String(n).padStart(2, '0')
const toHHMM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Combine a calendar date + an "HH:MM" time string into a local epoch (ms). */
const combine = (date: Date | undefined, time: string): number | null => {
  if (!date) return null
  const [hh, mm] = (time || '00:00').split(':').map(Number)
  const d = new Date(date)
  d.setHours(hh || 0, mm || 0, 0, 0)
  return d.getTime()
}

type DatetimePickerProps = {
  value: number | null
  onChange: (epoch: number) => void
  locale: Locale
}

/**
 * Date (react-day-picker) + time (native `<input type="time">`) picker. react-day-picker is
 * React-native with first-class RTL + locale support, so (unlike the old imperative calendar)
 * it needs no memo / dynamic-import gymnastics. The initial `value` seeds both inputs at mount;
 * the wizard remounts step content via `key={step}`, so navigating back restores the pick.
 *
 * Note: dates display in `Africa/Algiers` (DayPicker `timeZone`) but the epoch is built in the
 * browser's local zone — fine for Algeria-first hosts. Past dates are disabled.
 */
export const DatetimePicker = ({ value, onChange, locale }: DatetimePickerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => (value ? new Date(value) : undefined))
  const [timeStr, setTimeStr] = useState(() => (value ? toHHMM(new Date(value)) : '18:00'))

  const handleDate = (d: Date | undefined) => {
    setSelectedDate(d)
    const epoch = combine(d, timeStr)
    if (epoch !== null) onChange(epoch)
  }
  const handleTime = (t: string) => {
    setTimeStr(t)
    if (selectedDate) {
      const epoch = combine(selectedDate, t)
      if (epoch !== null) onChange(epoch)
    }
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
        <div className="relative">
          <Clock className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-base-content/40 ltr:left-3 rtl:right-3" />
          <input
            type="time"
            value={timeStr}
            onChange={(e) => handleTime(e.target.value)}
            className="input input-bordered w-full ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          />
        </div>
      </label>
    </div>
  )
}
