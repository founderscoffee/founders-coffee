import type { Money, Result } from '@founders-coffee/core';
import type { Order, OrderPurpose } from '@founders-coffee/db';

/** Who performed a payment action (recorded for audit, FR-M4). */
export interface PaymentActor {
  readonly userId: string;
  readonly note?: string;
}

/** Input to initiate a new pending Order + its 1:1 Invoice. */
export interface InitiatePaymentInput {
  readonly marketCode: string;
  readonly purpose: OrderPurpose;
  /** Polymorphic reference to what is being paid for (e.g. `sponsorship` / a sponsorship id). */
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly payerUserId?: string;
  readonly amount: Money;
  readonly billTo: { readonly name: string; readonly email: string };
  readonly note?: string;
}

/**
 * Abstraction over payment execution (AGENTS.md §11.5). `ManualProvider` is the
 * Year-1 real variant — no gateway; an admin confirms after external payment
 * (FR-M5). P4 gateway providers implement the same interface: `initiate` opens a
 * gateway session and a webhook calls `confirm` (NFR-10 — adding a provider must
 * not touch unrelated modules). Returns `Result` (the P0-012 hybrid model —
 * server functions unwrap via `handleResult`).
 */
export interface PaymentProvider {
  readonly name: string;
  initiate(input: InitiatePaymentInput): Promise<Result<Order>>;
  confirm(orderId: string, actor: PaymentActor): Promise<Result<Order>>;
  cancel(orderId: string, actor: PaymentActor): Promise<Result<Order>>;
  refund(orderId: string, actor: PaymentActor, reason?: string): Promise<Result<Order>>;
}
