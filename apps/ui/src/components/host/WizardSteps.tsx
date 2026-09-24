import type { ReactNode } from 'react';

import { StatusMessage } from '@founders-coffee/ui';

type WizardStepsProps = {
  current: number;
  labels: ReactNode[];
  ariaLabel?: string;
  statusText?: string;
};

export const WizardSteps = ({
  current,
  labels,
  ariaLabel,
  statusText,
}: WizardStepsProps) => (
  <nav className="w-full" aria-label={ariaLabel}>
    <StatusMessage variant="info" className="sr-only">
      {statusText}
    </StatusMessage>
    <ol className="sr-only">
      {labels.map((label, index) => (
        <li
          key={`step-${index + 1}`}
          aria-current={index + 1 === current ? 'step' : undefined}
        >
          {label}
        </li>
      ))}
    </ol>
    <ul className="steps steps-horizontal w-full" aria-hidden="true">
      {labels.map((label, index) => (
        <li
          key={`marker-${index + 1}`}
          className={`step text-caption font-medium ${
            index + 1 <= current ? 'step-primary' : ''
          }`}
        >
          {label}
        </li>
      ))}
    </ul>
  </nav>
);
