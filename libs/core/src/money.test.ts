import { describe, expect, it } from 'vitest';
import { createMoney, moneyToString } from './money.js';

describe('Money', () => {
  it('creates a money value with integer minor units', () => {
    const m = createMoney(1250, 'DZD');
    expect(m).toEqual({ amount_minor: 1250, currency: 'DZD' });
  });

  it('rejects non-integer minor units', () => {
    expect(() => createMoney(12.5, 'DZD')).toThrowError(/integer/);
  });

  it('formats major.minor with currency code', () => {
    expect(moneyToString(createMoney(1250, 'DZD'))).toBe('12.50 DZD');
    expect(moneyToString(createMoney(5, 'MAD'))).toBe('0.05 MAD');
  });

  it('formats negative amounts correctly', () => {
    expect(moneyToString(createMoney(-1250, 'SAR'))).toBe('-12.50 SAR');
  });
});
