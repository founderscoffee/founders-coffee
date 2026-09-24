import { cva } from 'class-variance-authority';
import {
  Children,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '../lib/cn.js';
import { statusRole, type StatusVariant } from '../lib/status.js';
import { StatusIcon } from './StatusIcon.js';

export const statusMessageVariants = cva(
  'alert alert-soft gap-3 text-body-sm',
  {
    variants: {
      variant: {
        success: 'alert-success',
        error: 'alert-error',
        warning: 'alert-warning',
        info: 'alert-info',
      },
    },
  },
);

export interface StatusMessageProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'role'
> {
  variant: StatusVariant;
  action?: ReactNode;
}

const isSilent = (children: ReactNode): boolean =>
  Children.toArray(children).every((child) => child === '');

export const StatusMessage = forwardRef<HTMLDivElement, StatusMessageProps>(
  ({ variant, action, className, children, ...props }, ref) => {
    const isEmpty = isSilent(children);
    return (
      <div
        {...props}
        ref={ref}
        role={statusRole(variant)}
        aria-atomic="true"
        className={
          isEmpty
            ? undefined
            : cn(statusMessageVariants({ variant }), className)
        }
      >
        {isEmpty ? null : (
          <>
            <StatusIcon
              variant={variant}
              className={cn('size-5 shrink-0', !action && 'self-start')}
            />
            <div className="min-w-0 break-words">{children}</div>
            {action}
          </>
        )}
      </div>
    );
  },
);
StatusMessage.displayName = 'StatusMessage';
