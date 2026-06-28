import { describe, expect, it } from 'vitest';

import { canTransition, isMarketVisible, transition, VISIBLE_STATES } from './state.js';

describe('market state machine', () => {
  it('allows dark→open, open→active, active→open, open→dark', () => {
    expect(canTransition('dark', 'open')).toBe(true);
    expect(canTransition('open', 'active')).toBe(true);
    expect(canTransition('active', 'open')).toBe(true);
    expect(canTransition('open', 'dark')).toBe(true);
  });

  it('denies skipping states (dark→active) and self-transitions', () => {
    expect(canTransition('dark', 'active')).toBe(false);
    expect(canTransition('active', 'dark')).toBe(false);
    expect(canTransition('open', 'open')).toBe(false);
  });

  it('transition returns ok with the target state, or err', () => {
    expect(transition('dark', 'open')).toEqual({ ok: true, data: 'open' });
    const result = transition('dark', 'active');
    expect(result.ok).toBe(false);
  });
});

describe('isMarketVisible', () => {
  it('hides dark markets, shows open + active', () => {
    expect(isMarketVisible('dark')).toBe(false);
    expect(isMarketVisible('open')).toBe(true);
    expect(isMarketVisible('active')).toBe(true);
    expect(VISIBLE_STATES).toEqual(['open', 'active']);
  });
});
