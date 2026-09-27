import { describe, expect, it } from 'vitest';

import { badgeVariants } from './components/Badge.js';
import { buttonVariants } from './components/Button.js';
import { INPUT_CLASS } from './components/Input.js';
import { SELECT_CLASS } from './components/Select.js';
import { statusMessageVariants } from './components/StatusMessage.js';

describe('libs/ui cva variants (literal class strings Tailwind can scan)', () => {
  it('Button defaults to primary at the responsive size, xs on a phone up to lg', () => {
    expect(buttonVariants()).toBe(
      'btn btn-xs sm:btn-sm md:btn-md lg:btn-lg btn-primary',
    );
  });

  it('Button composes variant + isFullWidth and has no other size', () => {
    expect(buttonVariants({ variant: 'secondary', isFullWidth: true })).toBe(
      'btn btn-xs sm:btn-sm md:btn-md lg:btn-lg btn-secondary w-full',
    );
  });

  it('Button maps the cta variant to clay, so one call to action reads louder', () => {
    expect(buttonVariants({ variant: 'cta' })).toBe(
      'btn btn-xs sm:btn-sm md:btn-md lg:btn-lg btn-secondary',
    );
  });

  it('Badge defaults to neutral md', () => {
    expect(badgeVariants()).toBe('badge badge-neutral badge-md');
  });

  it('Input is small below md and medium from it, with no other size', () => {
    expect(INPUT_CLASS).toBe('input input-sm md:input-md w-full');
  });

  it('Select follows Input, small below md and medium from it', () => {
    expect(SELECT_CLASS).toBe('select select-sm md:select-md w-full');
  });

  it('StatusMessage puts each severity on a soft daisyUI alert', () => {
    expect(statusMessageVariants({ variant: 'warning' })).toBe(
      'alert alert-soft gap-3 text-body-sm alert-warning',
    );
  });
});
