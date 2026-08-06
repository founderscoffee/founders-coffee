import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export const badgeVariants = cva('badge', {
  variants: {
    variant: {
      neutral: 'badge-neutral',
      primary: 'badge-primary',
      secondary: 'badge-secondary',
      accent: 'badge-accent',
      outline: 'badge-outline',
    },
    size: {
      sm: 'badge-sm',
      md: 'badge-md',
      lg: 'badge-lg',
    },
  },
  defaultVariants: { variant: 'neutral', size: 'md' },
});

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';
