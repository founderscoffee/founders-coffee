import { useEffect, useRef } from 'react'
import { PluginRegistry, TimepickerUI } from 'timepicker-ui'
import { RangePlugin } from 'timepicker-ui/plugins/range'

import { host_time, type Locale } from '@founders-coffee/i18n'

/* Register the range plugin once (module singleton, client-side via the lazy DatetimePicker chunk). */
PluginRegistry.register(RangePlugin)

type TimePickerProps = {
  /** Start time "HH:MM" (24h). */
  from: string
  /** End time "HH:MM" (24h). */
  to: string
  onChange: (from: string, to: string) => void
  locale: Locale
}

const LABELS = {
  ar: { ok: 'موافق', cancel: 'إلغاء', fromLabel: 'من', toLabel: 'إلى' },
  en: { ok: 'OK', cancel: 'Cancel', fromLabel: 'Start', toLabel: 'End' },
  fr: { ok: 'Valider', cancel: 'Annuler', fromLabel: 'Début', toLabel: 'Fin' },
} as const

const pad = (n: number) => String(n).padStart(2, '0')

/* timepicker-ui exposes no public setter for the range "to" slot, but the range manager
   (managers.plugins.range) has `setActivePart` + `handleMinuteCommit`, which set the active
   part's value AND re-render its segment. We use them to auto-advance "to" = from + 1h whenever
   the host picks/edits the start. Fragile w.r.t. upstream renames — pinned to timepicker-ui 4.x. */
type RangeManager = {
  setActivePart: (p: 'from' | 'to') => void
  handleMinuteCommit: (v: { hour: string; minutes: string }) => void
}
const getRangeManager = (picker: TimepickerUI): RangeManager | undefined => {
  const plugins = (picker as unknown as { managers: { plugins: { range?: RangeManager; get?: (k: string) => RangeManager } } }).managers.plugins
  return plugins.range ?? plugins.get?.('range')
}

/**
 * Material-style time RANGE picker (timepicker-ui v4 + RangePlugin). Read-only input that opens a
 * 24h clock modal with from/to segments; `onRangeConfirm` returns the chosen window, which feeds the
 * event's startsAt/endsAt directly (min 30 min, max 8 h). When the host sets the start, the end
 * auto-advances to start + 1 h. Runs once per mount — the step remounts via `key={step}`, so the
 * seeded from/to restore the prior pick. Themed to warm-cafe via styles.css.
 */
export const TimePicker = ({ from, to, onChange, locale }: TimePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const l = LABELS[locale]
    const picker = new TimepickerUI(el, {
      clock: { type: '24h' },
      range: { enabled: true, minDuration: 30, maxDuration: 480, fromLabel: l.fromLabel, toLabel: l.toLabel },
      labels: { ok: l.ok, cancel: l.cancel },
      callbacks: {
        onRangeConfirm: (data) => {
          if (data.from && data.to) onChange(data.from, data.to)
        },
      },
    })
    picker.create()

    /* Auto-link: track the start slot; when we switch to the end slot right after the start
       changed, set end = start + 1h. `fromDirty` gates it so manually editing the end is respected. */
    const rm = getRangeManager(picker)
    let activePart: 'from' | 'to' = 'from'
    let fromHour = from.slice(0, 2)
    let fromMin = from.slice(3, 5)
    let fromDirty = false

    if (rm) {
      const linkEnd = () => {
        rm.setActivePart('to')
        rm.handleMinuteCommit({ hour: pad((Number(fromHour) + 1) % 24), minutes: fromMin })
      }
      picker.on('range:switch', (d) => {
        activePart = d.active
        if (d.active === 'to' && fromDirty) {
          fromDirty = false
          linkEnd()
        }
      })
      picker.on('select:hour', (d) => {
        if (activePart === 'from') {
          fromHour = pad(Number(d.hour))
          fromDirty = true
        }
      })
      picker.on('select:minute', (d) => {
        if (activePart === 'from') {
          fromMin = pad(Number(d.minutes))
          fromDirty = true
        }
      })
    }

    return () => picker.destroy()
  }, [])

  return (
    <input
      ref={inputRef}
      type="text"
      readOnly
      defaultValue={`${from} - ${to}`}
      className="input input-bordered w-full cursor-pointer text-center text-base font-semibold"
      aria-label={host_time({}, { locale })}
    />
  )
}
