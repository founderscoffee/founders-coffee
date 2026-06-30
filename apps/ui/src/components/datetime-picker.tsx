import { useEffect, useRef } from 'react'
import { Calendar } from 'vanilla-calendar-pro'

/**
 * Lazy-loaded wrapper for vanilla-calendar-pro (daisyUI-themed via the `vc-*` classes). Mounts the
 * calendar on a container ref, with the 24h time picker enabled. Reads the selected datetime →
 * converts to epoch ms → `onChange(epoch)`.
 *
 * The calendar IS the UI (no separate input — `inputMode` defaults to `false`).
 */
export const DatetimePicker = ({
  value,
  onChange,
}: {
  value: number | null
  onChange: (epoch: number) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<Calendar | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const calendar = new Calendar(containerRef.current, {
      type: 'default',
      selectionTimeMode: '24',
      settings: {
        selection: {
          day: 'single',
          time: true,
        },
        visibility: {
          theme: 'light',
        },
      },
      actions: {
        clickDay(e, self) {
          updateValue(self)
        },
        changeTime(e, self) {
          updateValue(self)
        },
      },
    })
    calendarRef.current = calendar
    const destroy = calendar.init()

    return () => {
      destroy()
      calendar.destroy()
    }
  }, [])

  const updateValue = (self: { selectedDates: string[]; selectedTime?: string }) => {
    if (!self.selectedDates?.[0]) return
    const dateStr = self.selectedDates[0]
    const timeStr = self.selectedTime ?? '00:00'
    const epoch = new Date(`${dateStr}T${timeStr}:00`).getTime()
    if (!Number.isNaN(epoch)) onChange(epoch)
  }

  return <div ref={containerRef} className="vanilla-calendar" data-vc="wrapper" />
}
