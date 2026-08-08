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
  /** Optional label under each step icon — centered on that icon’s midpoint. */
  labels?: ReactNode[]
}

const stepCircleClass = (done: boolean, active: boolean) =>
  [
    'flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300',
    done && 'border-primary bg-primary text-primary-content shadow-md shadow-primary/20',
    active &&
      'scale-105 border-primary bg-base-100 text-primary shadow-lg shadow-primary/20 ring-4 ring-primary/15',
    !done && !active && 'border-base-300 bg-base-100 text-base-content/40',
  ]
    .filter(Boolean)
    .join(' ')

export const Stepper = ({ current, total, segments = [], labels = [] }: StepperProps) => {
  const hasLabels = labels.some((label) => label != null && label !== false && label !== '')

  return (
    <div className="w-full">
      <div className="flex w-full items-center">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1
          const done = n < current
          const active = n === current
          return (
            <Fragment key={n}>
              <div className={stepCircleClass(done, active)}>
                {done ? <Check className="h-5 w-5" /> : n}
              </div>

              {n < total && (
                <div className="relative mx-1 flex min-h-11 flex-1 items-center justify-center sm:mx-3">
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

      {hasLabels ? (
        <div className="mt-3 flex min-h-10 w-full items-start">
          {Array.from({ length: total }, (_, i) => (
            <Fragment key={`label-${i + 1}`}>
              <div className="relative flex w-11 shrink-0 justify-center">
                <p className="absolute left-1/2 top-0 w-28 -translate-x-1/2 text-center text-xs font-medium leading-snug text-base-content/55">
                  {labels[i]}
                </p>
              </div>
              {i < total - 1 ? <div className="mx-1 flex-1 sm:mx-3" aria-hidden="true" /> : null}
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  )
}
