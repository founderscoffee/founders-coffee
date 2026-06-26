import { describe, expect, it } from 'vitest';
import { allFlagsOff, isFeatureEnabled } from './feature-flags.js';

describe('feature flags', () => {
  it('allFlagsOff disables every flag', () => {
    const flags = allFlagsOff();
    expect(flags).toEqual({
      events: false,
      hackathons: false,
      payments: false,
      recruiting: false,
    });
  });

  it('isFeatureEnabled reads a flag value', () => {
    const flags = { ...allFlagsOff(), events: true };
    expect(isFeatureEnabled(flags, 'events')).toBe(true);
    expect(isFeatureEnabled(flags, 'hackathons')).toBe(false);
  });
});
