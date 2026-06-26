import { describe, expect, it } from 'vitest';
import { id } from './ids.js';

describe('id factory', () => {
  it('produces a prefixed id', () => {
    expect(id('evt')).toMatch(/^evt_[0-9a-f]{32}$/);
  });

  it('generates unique values', () => {
    const a = id('usr');
    const b = id('usr');
    expect(a).not.toBe(b);
  });

  it('reflects the prefix', () => {
    expect(id('ord').startsWith('ord_')).toBe(true);
  });
});
