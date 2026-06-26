import { describe, expect, it } from 'vitest';

import { badgeVariants } from './components/badge.js';
import { buttonVariants } from './components/button.js';
import { inputVariants } from './components/input.js';

describe('libs/ui cva variants (literal class strings Tailwind can scan)', () => {
  it('Button defaults to primary md', () => {
    expect(buttonVariants()).toBe('btn btn-primary btn-md');
  });

  it('Button composes variant + size + fullWidth', () => {
    expect(buttonVariants({ variant: 'secondary', size: 'sm', fullWidth: true })).toBe(
      'btn btn-secondary btn-sm w-full',
    );
  });

  it('Badge defaults to neutral md', () => {
    expect(badgeVariants()).toBe('badge badge-neutral badge-md');
  });

  it('Input defaults to md (inputSize, avoiding the native size collision)', () => {
    expect(inputVariants()).toBe('input input-bordered input-md');
  });
});
