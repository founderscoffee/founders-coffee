import { describe, expect, it } from 'vitest';
import { AppError } from './result.js';
import { optionalEnv, requireEnv } from './env.js';

describe('env accessors', () => {
  it('requireEnv returns a present value', () => {
    expect(requireEnv({ KEY: 'value' }, 'KEY')).toBe('value');
  });

  it('requireEnv throws AppError when missing', () => {
    try {
      requireEnv({}, 'KEY');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('env_missing');
    }
  });

  it('requireEnv throws on empty string', () => {
    expect(() => requireEnv({ KEY: '' }, 'KEY')).toThrowError(/KEY/);
  });

  it('optionalEnv returns undefined when missing', () => {
    expect(optionalEnv({}, 'KEY')).toBeUndefined();
    expect(optionalEnv({ KEY: 'x' }, 'KEY')).toBe('x');
  });
});
