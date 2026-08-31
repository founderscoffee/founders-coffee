import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('card border border-base-300 bg-base-200', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardBody = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('card-body', className)} {...props} />
));
CardBody.displayName = 'CardBody';

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn('card-title', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';
