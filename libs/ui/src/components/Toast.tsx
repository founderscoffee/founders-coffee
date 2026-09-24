import type { ReactNode } from 'react';

import { statusRole } from '../lib/status.js';
import type { ToastMessage } from '../lib/useToast.js';
import { StatusIcon } from './StatusIcon.js';

export const Toast = ({
  message,
  variant,
  dismissLabel,
  onDismiss,
  children,
}: ToastMessage & {
  dismissLabel?: string;
  onDismiss?: () => void;
  children?: ReactNode;
}) => (
  <div
    role={statusRole(variant)}
    aria-atomic="true"
    className={`alert ${variant === 'success' ? 'alert-success' : 'alert-error'} flex items-center gap-3 whitespace-normal shadow-lg`}
  >
    <StatusIcon variant={variant} className="size-5 shrink-0" />
    <span className="min-w-0 flex-1 break-words">{message}</span>
    {children}
    {onDismiss && dismissLabel && (
      <button
        type="button"
        className="btn btn-ghost btn-sm shrink-0 text-inherit"
        onClick={onDismiss}
        aria-label={dismissLabel}
      >
        <span aria-hidden="true">×</span>
      </button>
    )}
  </div>
);
