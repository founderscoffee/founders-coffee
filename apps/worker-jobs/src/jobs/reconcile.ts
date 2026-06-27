import { AppError, err, ok, type Result } from '@founders-coffee/core';
import { countOrdersByStatus, type Db } from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';

export interface ReconcileResult {
  readonly pending: number;
}

/**
 * Sweep pending Orders + log the backlog count (NFR-7 — alerting on payment-confirmation backlog).
 * The cron drives this; the RECONCILE queue allows ad-hoc runs. Enqueuing admin nudges for stale
 * payments lands at P1-014. Idempotent (a read-only count). Returns `Result` so the handler acks on
 * ok, retries on err.
 */
export const runReconcile = async (db: Db): Promise<Result<ReconcileResult>> => {
  try {
    const pending = await countOrdersByStatus(db, 'pending');
    logger.info('reconcile.pending_backlog', { count: pending });
    return ok({ pending });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'reconcile failed';
    logger.warn('reconcile.failed', { message });
    return err(new AppError('reconcile_failed', message));
  }
};
