import { describe, expect, it } from 'vitest';

import { badgeVariants } from './components/Badge.js';
import { buttonVariants } from './components/Button.js';
import { inputVariants } from './components/Input.js';

describe('libs/ui cva variants (literal class strings Tailwind can scan)', () => {
  it('Button defaults to primary md', () => {
    expect(buttonVariants()).toBe('btn btn-primary btn-md');
  });

  it('Button composes variant + size + isFullWidth', () => {
    expect(
      buttonVariants({ variant: 'secondary', size: 'sm', isFullWidth: true }),
    ).toBe('btn btn-secondary btn-sm w-full');
  });

  it('Button maps the cta variant to clay, so one call to action reads louder', () => {
    expect(buttonVariants({ variant: 'cta' })).toBe('btn btn-secondary btn-md');
  });

  it('Badge defaults to neutral md', () => {
    expect(badgeVariants()).toBe('badge badge-neutral badge-md');
  });

  it('Input defaults to md (inputSize, avoiding the native size collision)', () => {
    expect(inputVariants()).toBe('input input-bordered input-md');
  });
});
