import { z } from 'zod';

import type { CurrencyCode } from './money.js';
import { AppError } from './result.js';

export const CURRENCY_CODES = [
  'DZD',
  'MAD',
  'EGP',
  'SAR',
  'AED',
] as const satisfies readonly CurrencyCode[];

export const currencySchema = z.enum(CURRENCY_CODES);

export const moneySchema = z.object({
  amount_minor: z.number().int(),
  currency: currencySchema,
});

export const idSchema = z
  .string()
  .regex(/^[a-z]{2,8}_[0-9a-f]{32}$/, 'Invalid id');

export const marketCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Invalid market code');

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Adapt a Zod schema into a server-function validator that throws a typed
 * `AppError('validation_failed')` on invalid input. Validation failures flow through
 * the P0-012 throw boundary — the client reads `validation_failed` via `appErrorCode`
 * and the field errors from `AppError.details`. Use as
 * `createServerFn().validator(appValidator(schema))`.
 */
export const appValidator =
  <Output>(schema: z.ZodType<Output>) =>
  (input: unknown): Output => {
    const result = schema.safeParse(input);
    if (!result.success) {
      const flat = z.flattenError(result.error);
      throw new AppError('validation_failed', 'Invalid input', {
        fields: flat.fieldErrors,
        formErrors: flat.formErrors,
      });
    }
    return result.data;
  };
