import { describe, expect, it } from 'vitest';
import { getRequestContext, runWithContext } from './context.js';

describe('request context (AsyncLocalStorage)', () => {
  it('returns an empty context outside a scope', () => {
    expect(getRequestContext()).toEqual({});
  });

  it('exposes context inside runWithContext', () => {
    runWithContext({ market: 'DZ', requestId: 'r1' }, () => {
      expect(getRequestContext()).toEqual({ market: 'DZ', requestId: 'r1' });
    });
  });

  it('propagates across awaits', async () => {
    await runWithContext({ market: 'MA' }, async () => {
      await Promise.resolve();
      await Promise.resolve();
      expect(getRequestContext().market).toBe('MA');
    });
  });

  it('restores the previous context on exit', () => {
    runWithContext({ market: 'DZ' }, () => {
      runWithContext({ market: 'EG' }, () => {
        expect(getRequestContext().market).toBe('EG');
      });
      expect(getRequestContext().market).toBe('DZ');
    });
  });
});
