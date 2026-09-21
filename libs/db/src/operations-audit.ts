import { and, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import type {
  AuditAction,
  AuditTarget,
  OperationReason,
} from '@founders-coffee/core';

import type { Db } from './db.js';
import { operationsAudit, type OperationsAuditRow } from './schema.js';

export interface AuditEntry {
  readonly id: string;
  readonly actorUserId: string;
  readonly accessSubject: string | null;
  readonly action: AuditAction;
  readonly targetType: AuditTarget;
  readonly targetId: string;
  readonly reasonCode: OperationReason | null;
  readonly metadata: Record<string, unknown>;
}

/**
 * An audit insert that lands only if the write it accompanies did.
 *
 * The market code is selected from the same table the guarded write selected from, under the same
 * predicate — so when the guard refuses, this statement produces no row either, and an audit entry
 * describing something that did not happen cannot exist. Passing the market in from the caller
 * would have made that possible, which is why it is a column reference and a predicate rather than
 * a string.
 *
 * `source` is the table that predicate reads: `events` for anything about a meetup, `markets` for a
 * decision about a person or a week, which belongs to a market and to no single event.
 *
 * Every operations write pairs with one of these in a single `db.batch()`. The audit is written in
 * the same atomic batch as the change, so the stream and the mutable rows can never
 * disagree about what occurred: D1 applies both or neither.
 */
export const auditStatement = (
  db: Db,
  entry: AuditEntry,
  source: SQLiteTable,
  marketColumn: AnySQLiteColumn,
  where: SQL | undefined,
) =>
  db.insert(operationsAudit).select(
    db
      .select({
        id: sql<string>`${entry.id}`.as('id'),
        marketCode: marketColumn,
        actorUserId: sql<string>`${entry.actorUserId}`.as('actor_user_id'),
        accessSubject: sql<string | null>`${entry.accessSubject}`.as(
          'access_subject',
        ),
        action: sql<AuditAction>`${entry.action}`.as('action'),
        targetType: sql<AuditTarget>`${entry.targetType}`.as('target_type'),
        targetId: sql<string>`${entry.targetId}`.as('target_id'),
        reasonCode: sql<OperationReason | null>`${entry.reasonCode}`.as(
          'reason_code',
        ),
        metadata: sql<string>`${JSON.stringify(entry.metadata)}`.as('metadata'),
        createdAt: sql<number>`unixepoch()`.as('created_at'),
      })
      .from(source)
      .where(where),
  );

/**
 * Read the trail for one thing, newest first.
 *
 * Nothing in this module updates or deletes. An operations audit that could be edited is a record
 * of what somebody was willing to leave behind rather than of what happened, and CO-09's moderation
 * review depends on the difference.
 */
export const listAuditForTarget = (
  db: Db,
  opts: { targetType: AuditTarget; targetId: string; limit: number },
): Promise<OperationsAuditRow[]> =>
  db
    .select()
    .from(operationsAudit)
    .where(
      and(
        eq(operationsAudit.targetType, opts.targetType),
        eq(operationsAudit.targetId, opts.targetId),
      ),
    )
    .orderBy(desc(operationsAudit.createdAt))
    .limit(opts.limit);

export const listAuditForMarket = (
  db: Db,
  opts: { marketCode: string; since: Date; limit: number },
): Promise<OperationsAuditRow[]> =>
  db
    .select()
    .from(operationsAudit)
    .where(
      and(
        eq(operationsAudit.marketCode, opts.marketCode),
        gte(operationsAudit.createdAt, opts.since),
      ),
    )
    .orderBy(desc(operationsAudit.createdAt))
    .limit(opts.limit);
