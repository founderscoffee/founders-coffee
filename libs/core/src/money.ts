/**
 * Money value object — the ONLY legal representation of money in the system.
 * (AGENTS.md §6: always `{ amount_minor, currency }`; integer minor units; never floats.)
 *
 * Expanded in P0-005 (arithmetic, conversion, parsing, Result-based validation).
 * All founders.coffee currencies use 100 minor units per major unit:
 *   DZD (centime), MAD (santim), EGP (piastre), SAR (halala), AED (fils).
 */

export type CurrencyCode = 'DZD' | 'MAD' | 'EGP' | 'SAR' | 'AED';

export interface Money {
  readonly amount_minor: number; // integer minor units (e.g., centimes)
  readonly currency: CurrencyCode;
}

const MINOR_UNITS_PER_MAJOR = 100;

/** Create a Money value, enforcing integer minor units. Throws on non-integer input. */
export function createMoney(
  amount_minor: number,
  currency: CurrencyCode,
): Money {
  if (!Number.isInteger(amount_minor)) {
    throw new Error(
      `Money.amount_minor must be an integer (minor units), received ${amount_minor}`,
    );
  }
  return { amount_minor, currency };
}

/** Format a Money value as a human-readable string, e.g. `12.50 DZD`. */
export function moneyToString({ amount_minor, currency }: Money): string {
  const major = Math.trunc(amount_minor / MINOR_UNITS_PER_MAJOR);
  const minor = Math.abs(amount_minor % MINOR_UNITS_PER_MAJOR);
  return `${major}.${String(minor).padStart(2, '0')} ${currency}`;
}
