import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import type { OrderStatus } from '@founders-coffee/domain';
import { transition } from '@founders-coffee/domain';
import {
  createInvoice,
  createOrder,
  getOrder,
  transitionStatus,
  type Db,
  type NewOrder,
  type Order,
} from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';

import type {
  InitiatePaymentInput,
  PaymentActor,
  PaymentProvider,
} from './provider.js';

const now = (): Date => new Date();

/**
 * Build the Year-1 `ManualProvider` bound to a D1 instance. Construct per request
 * (`createManualProvider(createDb(env.DB))`) — like `createAuth(env)`, never a
 * module singleton. Records Orders/Invoices + transitions status atomically; an
 * admin calls `confirm` after the external payment lands (FR-M5). No gateway —
 * the provider is the manual "real variant" (AGENTS.md §11.5), testable with
 * real D1 (no dev variant needed).
 */
export const createManualProvider = (db: Db): PaymentProvider => {
  /** Shared pending→target flow for confirm/cancel/refund (atomic + idempotent). */
  const changeStatus = async (
    orderId: string,
    to: OrderStatus,
    actor: PaymentActor,
    patch: Partial<NewOrder>,
    eventName: string,
  ): Promise<Result<Order>> => {
    const order = await getOrder(db, orderId);
    if (!order) {
      return err(
        new AppError('order_not_found', `Order not found: ${orderId}`),
      );
    }
    if (order.status === to) {
      logger.info(`payment.${eventName}.idempotent`, {
        orderId,
        actorUserId: actor.userId,
      });
      return ok(order);
    }
    const allowed = transition(order.status, to);
    if (!allowed.ok) return err(allowed.error);

    const changed = await transitionStatus(
      db,
      orderId,
      order.status,
      to,
      patch,
    );
    if (changed === 0) {
      const current = await getOrder(db, orderId);
      if (current?.status === to) return ok(current);
      return err(
        new AppError(
          'order_not_pending',
          `Order ${orderId} is '${current?.status ?? 'gone'}', cannot ${eventName}`,
        ),
      );
    }
    const updated = await getOrder(db, orderId);
    if (!updated) {
      return err(
        new AppError(
          'order_not_found',
          `Order vanished after transition: ${orderId}`,
        ),
      );
    }
    logger.info(`payment.${eventName}`, {
      orderId,
      actorUserId: actor.userId,
      note: actor.note,
    });
    return ok(updated);
  };

  return {
    name: 'manual',

    initiate: async (input: InitiatePaymentInput): Promise<Result<Order>> => {
      const orderId = id('ord');
      const invoiceId = id('inv');
      const order = await createOrder(db, {
        id: orderId,
        marketCode: input.marketCode,
        purpose: input.purpose,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        payerUserId: input.payerUserId,
        amountMinor: input.amount.amount_minor,
        currency: input.amount.currency,
        status: 'pending',
        provider: 'manual',
        note: input.note,
      });
      await createInvoice(db, {
        id: invoiceId,
        orderId,
        number: `INV-${invoiceId}`,
        billToName: input.billTo.name,
        billToEmail: input.billTo.email,
        amountMinor: input.amount.amount_minor,
        currency: input.amount.currency,
      });
      logger.info('payment.initiated', {
        orderId,
        marketCode: input.marketCode,
        purpose: input.purpose,
      });
      return ok(order);
    },

    confirm: (orderId, actor) =>
      changeStatus(orderId, 'paid', actor, { paidAt: now() }, 'confirmed'),

    cancel: (orderId, actor) =>
      changeStatus(
        orderId,
        'cancelled',
        actor,
        { cancelledAt: now() },
        'cancelled',
      ),

    refund: (orderId, actor, reason) =>
      changeStatus(
        orderId,
        'refunded',
        { ...actor, note: reason ?? actor.note },
        { refundedAt: now() },
        'refunded',
      ),
  };
};
