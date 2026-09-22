import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../lib/cn.js';
import { defaultFieldDirection } from '../lib/field-direction.js';

export const inputVariants = cva('input input-bordered w-full', {
  variants: {
    inputSize: { sm: 'input-sm', md: 'input-md', lg: 'input-lg' },
  },
  defaultVariants: { inputSize: 'md' },
});

export interface InputProps
  extends
    InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize, type = 'text', dir, inputMode, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      dir={dir ?? defaultFieldDirection(type, inputMode)}
      inputMode={inputMode}
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
