import { describe, expect, it } from 'vitest';
import {
  addMoney,
  createMoney,
  createMoneySafe,
  moneyToString,
  subtractMoney,
  zeroMoney,
} from './money.js';

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

  it('zeroMoney produces a zero value in the given currency', () => {
    expect(zeroMoney('EGP')).toEqual({ amount_minor: 0, currency: 'EGP' });
  });

  it('addMoney sums same-currency values', () => {
    expect(addMoney(createMoney(100, 'DZD'), createMoney(50, 'DZD'))).toEqual({
      amount_minor: 150,
      currency: 'DZD',
    });
  });

  it('subtractMoney subtracts same-currency values', () => {
    expect(
      subtractMoney(createMoney(100, 'DZD'), createMoney(30, 'DZD')),
    ).toEqual({ amount_minor: 70, currency: 'DZD' });
  });

  it('addMoney throws on currency mismatch', () => {
    expect(() =>
      addMoney(createMoney(100, 'DZD'), createMoney(50, 'MAD')),
    ).toThrowError(/mismatch/);
  });

  it('createMoneySafe returns ok for valid input', () => {
    expect(createMoneySafe(1250, 'AED')).toEqual({
      ok: true,
      data: { amount_minor: 1250, currency: 'AED' },
    });
  });

  it('createMoneySafe returns err (no throw) for non-integer input', () => {
    const result = createMoneySafe(12.5, 'AED');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('money_non_integer');
    }
  });
});
