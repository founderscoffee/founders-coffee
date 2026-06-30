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
  onChange,
}: {
  value: number | null
  onChange: (epoch: number) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const readValue = (self: Calendar) => {
      const dates = self.context.selectedDates
      if (!dates?.[0]) return
      const dateStr = dates[0]
      const timeStr = self.context.selectedTime ?? '00:00'
      const epoch = new Date(`${dateStr}T${timeStr}:00`).getTime()
      if (!Number.isNaN(epoch)) onChange(epoch)
    }

    const calendar = new Calendar(containerRef.current, {
      type: 'default',
      selectionTimeMode: 24,
      onClickDate: (self: Calendar) => readValue(self),
      onChangeTime: (self: Calendar) => readValue(self),
    })
    const destroy = calendar.init()

    return () => {
      destroy()
      calendar.destroy()
    }
  }, [onChange])

  return <div ref={containerRef} className="vanilla-calendar" data-vc="wrapper" />
}
