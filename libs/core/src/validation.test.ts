import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError } from './result.js';
import {
  appValidator,
  emailSchema,
  idSchema,
  marketCodeSchema,
  moneySchema,
  paginationSchema,
} from './validation.js';

describe('appValidator', () => {
  const validate = appValidator(
    z.object({ name: z.string(), age: z.number().int() }),
  );

  it('returns the parsed value for valid input', () => {
    expect(validate({ name: 'Amine', age: 30 })).toEqual({
      name: 'Amine',
      age: 30,
    });
  });

  it('throws AppError(validation_failed) with field errors for invalid input', () => {
    try {
      validate({ name: 123, age: 'x' });
      throw new Error('should have thrown');
    } catch (error) {
      const e = error as AppError;
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('validation_failed');
      const details = e.details as { fields: Record<string, unknown> };
      expect(details.fields).toHaveProperty('name');
      expect(details.fields).toHaveProperty('age');
    }
  });

  it('throws (does not return) so the failure reaches TanStack Query', () => {
    expect(() => validate({ wrong: true })).toThrowError(AppError);
  });
});

describe('primitive schemas', () => {
  it('moneySchema accepts valid money and rejects bad amounts/currencies', () => {
    expect(
      moneySchema.safeParse({ amount_minor: 1250, currency: 'DZD' }).success,
    ).toBe(true);
    expect(
      moneySchema.safeParse({ amount_minor: 12.5, currency: 'DZD' }).success,
    ).toBe(false);
    expect(
      moneySchema.safeParse({ amount_minor: 10, currency: 'USD' }).success,
    ).toBe(false);
  });

  it('idSchema validates the prefixed id format', () => {
    expect(idSchema.safeParse(`evt_${'a'.repeat(32)}`).success).toBe(true);
    expect(idSchema.safeParse('evt_short').success).toBe(false);
    expect(idSchema.safeParse('not-an-id').success).toBe(false);
  });

  it('marketCodeSchema validates ISO-2 codes', () => {
    expect(marketCodeSchema.safeParse('DZ').success).toBe(true);
    expect(marketCodeSchema.safeParse('dz').success).toBe(false);
    expect(marketCodeSchema.safeParse('DZA').success).toBe(false);
  });

  it('paginationSchema applies defaults and enforces bounds', () => {
    const defaulted = paginationSchema.safeParse({});
    expect(defaulted.success).toBe(true);
    if (defaulted.success)
      expect(defaulted.data).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 200 }).success).toBe(false);
  });

  it('emailSchema accepts valid emails, trims+lowercases, and rejects malformed', () => {
    expect(emailSchema.safeParse('founder@example.com').success).toBe(true);
    expect(emailSchema.safeParse('  Founder@Example.COM  ').success).toBe(true);
    const normalized = emailSchema.safeParse('  Founder@Example.COM  ');
    if (normalized.success) expect(normalized.data).toBe('founder@example.com');
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('missing@domain').success).toBe(false);
    expect(emailSchema.safeParse('@nodomain.com').success).toBe(false);
  });
});
