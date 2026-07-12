import { Check } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

type StepperProps = {
  current: number
  total: number
  /**
   * Optional content rendered centered on each connector — `segments[0]` sits between icons 1
   * and 2, `segments[1]` between 2 and 3, etc. Pass `null`/`undefined` for a plain connector.
   * The track + fill line run behind the content (which needs an opaque background to sit on
   * the line); everything shares the row's vertical center.
   */
  segments?: ReactNode[]
}

export const Stepper = ({ current, total, segments = [] }: StepperProps) => (
  <div className="flex w-full items-center">
    {Array.from({ length: total }, (_, i) => {
      const n = i + 1
      const done = n < current
      const active = n === current
      return (
        <Fragment key={n}>
          <div
            className={[
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300',
              done && 'border-primary bg-primary text-primary-content shadow-md shadow-primary/20',
              active && 'border-primary bg-base-100 text-primary ring-4 ring-primary/15 scale-105 shadow-lg shadow-primary/20',
              !done && !active && 'border-base-300 bg-base-100 text-base-content/40',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {done ? <Check className="h-5 w-5" /> : n}
          </div>

          {n < total && (
            <div className="relative mx-1 flex min-h-11 flex-1 items-center justify-center sm:mx-3">
              {/* track + fill share the connector's vertical center; the segment content sits on
                  top with an opaque background so the line appears to pass behind it. */}
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-base-300" />
              <div
                className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-500"
                style={{ width: done ? '100%' : '0%' }}
              />
              {segments[i] && <div className="relative z-10 max-w-full">{segments[i]}</div>}
            </div>
          )}
        </Fragment>
      )
    })}
  </div>
)
