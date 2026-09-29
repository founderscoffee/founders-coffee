import { useEffect, useRef, useState, type ReactNode } from 'react';

import { statusRole } from '../lib/status.js';
import type { ToastMessage } from '../lib/useToast.js';
import { StatusIcon } from './StatusIcon.js';

export const TOAST_DURATION_MS = 5_000;

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
}) => {
  const [isPointedAt, setIsPointedAt] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const canDismiss = onDismiss !== undefined;

  useEffect(() => {
    if (!canDismiss || isPointedAt || hasFocus) return;
    const timeout = setTimeout(() => dismiss.current?.(), TOAST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [canDismiss, isPointedAt, hasFocus, message, variant]);

  return (
    <div
      role={statusRole(variant)}
      aria-atomic="true"
      className={`alert ${variant === 'success' ? 'alert-success' : 'alert-error'} flex items-center gap-3 whitespace-normal shadow-lg`}
      onPointerEnter={() => setIsPointedAt(true)}
      onPointerLeave={() => setIsPointedAt(false)}
      onFocus={() => setHasFocus(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocus(false);
        }
      }}
    >
      <StatusIcon variant={variant} className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {children}
      {onDismiss && dismissLabel && (
        <button
          type="button"
          className="btn btn-ghost btn-xs sm:btn-sm md:btn-md shrink-0 text-inherit"
          onClick={onDismiss}
          aria-label={dismissLabel}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
};
