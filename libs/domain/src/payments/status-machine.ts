import {
  AppError,
  err,
  ok,
  type OrderStatus,
  type Result,
} from '@founders-coffee/core';

export type { OrderStatus } from '@founders-coffee/core';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['refunded'],
  cancelled: [],
  refunded: [],
};

/** Whether `from → to` is a legal Order transition. */
export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  TRANSITIONS[from].includes(to);

/**
 * Validate + apply a status transition. Pure — the single source of truth for
 * Order lifecycle rules (AGENTS.md §6: status transitions live in libs/domain).
 * Returns `ok(next)` or `err(AppError('invalid_order_transition'))` so callers
 * (the PaymentProvider) stay in the Result flow — no throws in domain.
 */
export const transition = (
  from: OrderStatus,
  to: OrderStatus,
): Result<OrderStatus> =>
  canTransition(from, to)
    ? ok(to)
    : err(
        new AppError(
          'invalid_order_transition',
          `Cannot transition order from '${from}' to '${to}'`,
        ),
      );
