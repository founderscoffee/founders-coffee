import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';

export const SELECT_CLASS = 'select select-sm md:select-md w-full';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(SELECT_CLASS, className)} {...props} />
  ),
);
Select.displayName = 'Select';
