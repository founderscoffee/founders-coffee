import type { ReactNode } from 'react';

import { cn } from '../lib/cn.js';

export interface LoadingStatusProps {
  label: string;
  isLabelHidden?: boolean;
  className?: string;
  children?: ReactNode;
}

export const LoadingStatus = ({
  label,
  isLabelHidden = false,
  className,
  children,
}: LoadingStatusProps) => (
  <div
    role="status"
    aria-atomic="true"
    className={cn(
      'flex items-center gap-2 text-body-sm text-neutral',
      className,
    )}
  >
    {isLabelHidden ? null : (
      <span
        className="loading loading-spinner loading-xs shrink-0"
        aria-hidden="true"
      />
    )}
    {children}
    <span className={isLabelHidden ? 'sr-only' : undefined}>{label}</span>
  </div>
);
