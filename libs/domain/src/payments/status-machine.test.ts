import { AppError } from '@founders-coffee/core';
import { describe, expect, it } from 'vitest';

import { canTransition, transition } from './status-machine.js';

describe('Order status machine', () => {
  it('allows pending → paid and pending → cancelled', () => {
    expect(canTransition('pending', 'paid')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
  });

  it('allows paid → refunded', () => {
    expect(canTransition('paid', 'refunded')).toBe(true);
  });

  it('denies illegal transitions', () => {
    expect(canTransition('pending', 'refunded')).toBe(false);
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(canTransition('refunded', 'pending')).toBe(false);
    expect(canTransition('paid', 'pending')).toBe(false);
  });

  it('transition returns ok(next) for a legal transition', () => {
    expect(transition('pending', 'paid')).toEqual({ ok: true, data: 'paid' });
  });

  it('transition returns err(AppError) for an illegal transition', () => {
    const result = transition('cancelled', 'paid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.code).toBe('invalid_order_transition');
    }
  });
});
