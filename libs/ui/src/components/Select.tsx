import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export const selectVariants = cva('select select-bordered w-full', {
  variants: {
    selectSize: { sm: 'select-sm', md: 'select-md', lg: 'select-lg' },
  },
  defaultVariants: { selectSize: 'md' },
});

export interface SelectProps
  extends
    SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof selectVariants> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, selectSize, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(selectVariants({ selectSize }), className)}
      {...props}
    />
  ),
);
Select.displayName = 'Select';
