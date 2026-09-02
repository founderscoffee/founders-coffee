import { Check } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

type StepperProps = {
  current: number;
  total: number;
  segments?: ReactNode[];
  labels?: ReactNode[];
  ariaLabel?: string;
  statusText?: string;
};

const stepCircleClass = (done: boolean, active: boolean) =>
  [
    'flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300',
    done &&
      'border-primary bg-primary text-primary-content shadow-md shadow-primary/20',
    active &&
      'scale-105 border-primary bg-base-100 text-primary shadow-lg shadow-primary/20 ring-4 ring-primary/15',
    !done && !active && 'border-base-300 bg-base-100 text-base-content/40',
  ]
    .filter(Boolean)
    .join(' ');

const stepLabelClass = (index: number, total: number) => {
  const position =
    index === 0
      ? 'start-0 text-start'
      : index === total - 1
        ? 'end-0 text-end'
        : 'start-1/2 -translate-x-1/2 text-center rtl:translate-x-1/2';
  return `absolute top-0 w-28 text-xs font-medium leading-snug text-base-content/55 ${position}`;
};

export const Stepper = ({
  current,
  total,
  segments = [],
  labels = [],
  ariaLabel,
  statusText,
}: StepperProps) => {
  const hasLabels = labels.some(
    (label) => label != null && label !== false && label !== '',
  );

  return (
    <nav className="w-full" aria-label={ariaLabel}>
      {statusText && (
        <p className="sr-only" role="status" aria-live="polite">
          {statusText}
        </p>
      )}
      <ol className="sr-only">
        {Array.from({ length: total }, (_, i) => (
          <li key={i + 1} aria-current={i + 1 === current ? 'step' : undefined}>
            {labels[i] ?? i + 1}
          </li>
        ))}
      </ol>
      <div className="flex w-full items-center" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <Fragment key={n}>
              <div className={stepCircleClass(done, active)}>
                {done ? <Check className="h-5 w-5" /> : n}
              </div>

              {n < total && (
                <div className="relative mx-1 flex min-h-11 flex-1 items-center justify-center sm:mx-3">
                  <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-base-300" />
                  <div
                    className="absolute start-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-500"
                    style={{ width: done ? '100%' : '0%' }}
                  />
                  {segments[i] && (
                    <div className="relative z-10 max-w-full">
                      {segments[i]}
                    </div>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {hasLabels ? (
        <div className="mt-3 flex min-h-10 w-full items-start">
          {Array.from({ length: total }, (_, i) => (
            <Fragment key={`label-${i + 1}`}>
              <div className="relative flex w-11 shrink-0 justify-center">
                <p className={stepLabelClass(i, total)}>{labels[i]}</p>
              </div>
              {i < total - 1 ? (
                <div className="mx-1 flex-1 sm:mx-3" aria-hidden="true" />
              ) : null}
            </Fragment>
          ))}
        </div>
      ) : null}
    </nav>
  );
};
