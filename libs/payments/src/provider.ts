import type { Money, Result } from '@founders-coffee/core';
import type { Order, OrderPurpose } from '@founders-coffee/db';

export interface PaymentActor {
  readonly userId: string;
  readonly note?: string;
}

export interface InitiatePaymentInput {
  readonly marketCode: string;
  readonly purpose: OrderPurpose;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly payerUserId?: string;
  readonly amount: Money;
  readonly billTo: { readonly name: string; readonly email: string };
  readonly note?: string;
}

export interface PaymentProvider {
  readonly name: string;
  initiate(input: InitiatePaymentInput): Promise<Result<Order>>;
  confirm(orderId: string, actor: PaymentActor): Promise<Result<Order>>;
  cancel(orderId: string, actor: PaymentActor): Promise<Result<Order>>;
  refund(
    orderId: string,
    actor: PaymentActor,
    reason?: string,
  ): Promise<Result<Order>>;
}
