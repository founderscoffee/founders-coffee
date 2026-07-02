import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export interface CountdownProps extends HTMLAttributes<HTMLSpanElement> {
  seconds: number;
  ariaLabel?: string;
}

export const Countdown = ({
  seconds,
  ariaLabel,
  className,
  ...props
}: CountdownProps) => (
  <span
    className={cn('countdown font-mono text-lg', className)}
    aria-live='polite'
    aria-label={ariaLabel}
    {...props}
  >
    <span style={{ '--value': seconds } as React.CSSProperties}>{seconds}</span>
  </span>
);
Countdown.displayName = 'Countdown';
