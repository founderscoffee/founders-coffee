import { describe, expect, it } from 'vitest';
import { id, prefixedId, shortId } from './ids.js';

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

describe('the half of an id that travels in a URL', () => {
  it('makes the round trip, which is the whole point of the pair', () => {
    const full = id('evt');
    expect(prefixedId('evt', shortId(full))).toBe(full);
  });

  it('takes the prefix off, and nothing else', () => {
    expect(shortId('evt_8f3b')).toBe('8f3b');
    expect(shortId('usr_8f3b')).toBe('8f3b');
  });

  it('leaves an id alone that has no prefix to take off', () => {
    expect(shortId('8f3b')).toBe('8f3b');
  });

  it('does not mistake a hex run for a prefix', () => {
    expect(shortId('evt_abc_def')).toBe('abc_def');
    expect(shortId('8f3b_abcd')).toBe('8f3b_abcd');
  });
});
