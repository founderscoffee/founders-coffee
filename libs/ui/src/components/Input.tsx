import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';
import { defaultFieldDirection } from '../lib/field-direction.js';

export const INPUT_CLASS = 'input input-sm md:input-md w-full';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', dir, inputMode, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      dir={dir ?? defaultFieldDirection(type, inputMode)}
      inputMode={inputMode}
      className={cn(INPUT_CLASS, className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
